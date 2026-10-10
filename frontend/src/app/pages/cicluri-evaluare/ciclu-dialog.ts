import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { Criterion, Cycle, CycleBody, EvaluationService } from '../../core/evaluation/evaluation.service';
import { problemDetail } from '../../core/leave/leave.service';
import { toIsoDate } from '../../shared/format/date';

const NAME_MAX = 120;
const CRITERION_NAME_MAX = 100;
const MIN_CRITERIA = 1;
const MAX_CRITERIA = 10;

/** "Calitatea muncii" => "calitatea-muncii" (fără diacritice, [a-z0-9-], max 40). */
function slug(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 34);
  return s || 'criteriu';
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function criterionGroup(c?: Criterion) {
  return new FormGroup({
    key: new FormControl(c?.key ?? '', { nonNullable: true }),
    name: new FormControl(c?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(CRITERION_NAME_MAX)],
    }),
    weight: new FormControl<number | null>(c?.weight ?? null, [Validators.required, Validators.min(1), Validators.max(100)]),
  });
}

function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as Date | null;
  const end = group.get('endDate')?.value as Date | null;
  return start && end && end < start ? { range: true } : null;
}

@Component({
  selector: 'app-ciclu-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DatePickerModule, DialogModule, InputNumberModule, InputTextModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" [header]="cycle() ? 'Editează ciclul' : 'Ciclu nou'"
              [style]="{ width: '44rem' }" [breakpoints]="{ '760px': '94vw' }">
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label class="t-label" for="ciclu-nume">Nume</label>
          <input pInputText id="ciclu-nume" formControlName="name" [fluid]="true" autocomplete="off"
                 [invalid]="submitted() && form.controls.name.invalid" />
          @if (submitted() && form.controls.name.hasError('maxlength')) {
            <p class="t-body-sm err">Numele poate avea cel mult {{ nameMax }} de caractere.</p>
          } @else if (submitted() && form.controls.name.invalid) {
            <p class="t-body-sm err">Numele este obligatoriu.</p>
          }
        </div>

        <div class="dates">
          <div class="field">
            <label class="t-label" for="ciclu-start">Data de început</label>
            <p-datepicker inputId="ciclu-start" formControlName="startDate" dateFormat="d M yy" [firstDayOfWeek]="1"
                          [readonlyInput]="true" appendTo="body" [fluid]="true"
                          [invalid]="submitted() && form.controls.startDate.invalid" />
            @if (submitted() && form.controls.startDate.invalid) {
              <p class="t-body-sm err">Alege data de început.</p>
            }
          </div>
          <div class="field">
            <label class="t-label" for="ciclu-sfarsit">Data de sfârșit</label>
            <p-datepicker inputId="ciclu-sfarsit" formControlName="endDate" dateFormat="d M yy" [firstDayOfWeek]="1"
                          [readonlyInput]="true" appendTo="body" [fluid]="true"
                          [invalid]="submitted() && (form.controls.endDate.invalid || form.hasError('range'))" />
            @if (submitted() && form.controls.endDate.invalid) {
              <p class="t-body-sm err">Alege data de sfârșit.</p>
            } @else if (submitted() && form.hasError('range')) {
              <p class="t-body-sm err">Data de sfârșit nu poate fi înaintea celei de început.</p>
            }
          </div>
        </div>

        <fieldset class="criteria">
          <legend class="t-label">Criterii de evaluare</legend>
          <p class="t-body-sm t-muted">Între {{ minCriteria }} și {{ maxCriteria }} criterii. Ponderile trebuie să însumeze 100.</p>
          @for (c of form.controls.criteria.controls; track c; let i = $index) {
            <div class="crit-row" [formGroup]="c">
              <div class="field grow">
                <label class="t-label" [for]="'crit-nume-' + i">Nume criteriu {{ i + 1 }}</label>
                <input pInputText [id]="'crit-nume-' + i" formControlName="name" [fluid]="true" autocomplete="off"
                       [invalid]="submitted() && c.controls.name.invalid" />
                @if (submitted() && c.controls.name.invalid) {
                  <p class="t-body-sm err">Numele criteriului este obligatoriu (cel mult {{ criterionNameMax }} de caractere).</p>
                }
              </div>
              <div class="field weight">
                <label class="t-label" [for]="'crit-pondere-' + i">Pondere (%)</label>
                <p-inputnumber [inputId]="'crit-pondere-' + i" formControlName="weight" [min]="1" [max]="100"
                               [useGrouping]="false" [fluid]="true"
                               [invalid]="submitted() && c.controls.weight.invalid" />
                @if (submitted() && c.controls.weight.invalid) {
                  <p class="t-body-sm err">1 - 100.</p>
                }
              </div>
              <p-button icon="pi pi-trash" severity="secondary" [text]="true" label="Șterge"
                        [ariaLabel]="'Șterge criteriul ' + (i + 1)" [disabled]="form.controls.criteria.length <= minCriteria || busy()"
                        (onClick)="removeCriterion(i)" />
            </div>
          }
          <div class="crit-foot">
            <p-button label="Adaugă criteriu" icon="pi pi-plus" severity="secondary" [outlined]="true"
                      [disabled]="form.controls.criteria.length >= maxCriteria || busy()" (onClick)="addCriterion()" />
            <p class="t-body-sm total" [class.err]="totalWrong()" [class.t-muted]="!totalWrong()" aria-live="polite">
              Total ponderi: <strong class="num">{{ total() }}</strong> din 100
              @if (totalWrong()) { (trebuie să fie 100) }
            </p>
          </div>
        </fieldset>

        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button [label]="cycle() ? 'Salvează modificările' : 'Creează ciclul'" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form { display: grid; gap: var(--space-4); }
    .field { display: grid; gap: var(--space-1); align-content: start; }
    .field p, .criteria p { margin: 0; }
    .dates { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
    .criteria { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: var(--space-3); }
    .criteria legend { padding: 0; margin-bottom: var(--space-1); }
    .crit-row { display: flex; align-items: flex-start; gap: var(--space-3); }
    .grow { flex: 1; min-width: 0; }
    .weight { width: 8rem; flex: none; }
    .crit-row p-button { margin-top: 26px; }
    .crit-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); }
    .err { color: var(--danger-ink); }
    @media (max-width: 760px) { .dates { grid-template-columns: 1fr; } }
  `,
})
export class CicluDialog implements OnInit {
  private readonly service = inject(EvaluationService);
  private readonly destroyRef = inject(DestroyRef);

  /** Ciclul editat (doar Ciornă); null la creare. */
  readonly cycle = input<Cycle | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly nameMax = NAME_MAX;
  protected readonly criterionNameMax = CRITERION_NAME_MAX;
  protected readonly minCriteria = MIN_CRITERIA;
  protected readonly maxCriteria = MAX_CRITERIA;
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly total = signal(0);
  protected readonly totalWrong = computed(() => this.total() !== 100);

  protected readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(NAME_MAX)],
      }),
      startDate: new FormControl<Date | null>(null, Validators.required),
      endDate: new FormControl<Date | null>(null, Validators.required),
      criteria: new FormArray([criterionGroup()]),
    },
    { validators: endAfterStart },
  );

  constructor() {
    this.form.controls.criteria.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateTotal());
  }

  ngOnInit(): void {
    const c = this.cycle();
    if (c) {
      this.form.patchValue({ name: c.name, startDate: parseIso(c.startDate), endDate: parseIso(c.endDate) });
      this.form.controls.criteria.clear();
      c.criteria.forEach((x) => this.form.controls.criteria.push(criterionGroup(x)));
    }
    this.updateTotal();
  }

  protected addCriterion(): void {
    this.form.controls.criteria.push(criterionGroup());
  }

  protected removeCriterion(i: number): void {
    this.form.controls.criteria.removeAt(i);
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  protected submit(): void {
    if (this.busy()) {
      return;
    }
    this.submitted.set(true);
    this.error.set('');
    const v = this.form.getRawValue();
    const count = v.criteria.length;
    if (this.form.invalid || this.totalWrong() || count < MIN_CRITERIA || count > MAX_CRITERIA) {
      return;
    }
    // Cheia se generează din nume (slug) și rămâne unică în ciclu.
    const used = new Set<string>();
    const criteria: Criterion[] = v.criteria.map((c) => {
      const name = c.name.trim();
      const base = c.key || slug(name);
      let key = base;
      for (let n = 2; used.has(key); n++) {
        key = `${base.slice(0, 36)}-${n}`;
      }
      used.add(key);
      return { key, name, weight: c.weight ?? 0 };
    });
    const body: CycleBody = {
      name: v.name.trim(),
      startDate: toIsoDate(v.startDate as Date),
      endDate: toIsoDate(v.endDate as Date),
      criteria,
    };
    const existing = this.cycle();
    const call = existing ? this.service.updateCycle(existing.id, body) : this.service.createCycle(body);
    this.busy.set(true);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(problemDetail(err));
      },
    });
  }

  private updateTotal(): void {
    this.total.set(
      this.form.controls.criteria.controls.reduce((sum, g) => sum + (g.controls.weight.value ?? 0), 0),
    );
  }
}
