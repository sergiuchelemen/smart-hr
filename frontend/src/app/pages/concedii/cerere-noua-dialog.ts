import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { LEAVE_TYPE_LABELS, LeaveService, LeaveType, problemDetail } from '../../core/leave/leave.service';
import { toIsoDate } from '../../shared/format/date';

type DaysState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; days: number }
  | { kind: 'error'; message: string };

const NOTE_MAX = 500;

function completeRange(control: { value: (Date | null)[] | null }): ValidationErrors | null {
  const v = control.value;
  return v && v[0] && v[1] ? null : { range: true };
}

@Component({
  selector: 'app-new-leave-request-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DatePickerModule, DialogModule, MessageModule, SelectModule, TextareaModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" header="Cerere nouă de concediu"
              [style]="{ width: '34rem' }" [breakpoints]="{ '640px': '94vw' }">
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" id="form-cerere" novalidate>
        <div class="field">
          <label class="t-label" for="cerere-tip">Tip</label>
          <p-select inputId="cerere-tip" formControlName="type" [options]="typeOptions" optionLabel="label"
                    optionValue="value" appendTo="body" [fluid]="true"
                    [invalid]="submitted() && form.controls.type.invalid" />
          @if (submitted() && form.controls.type.invalid) {
            <p class="t-body-sm err">Alege tipul concediului.</p>
          }
        </div>

        <div class="field">
          <label class="t-label" for="cerere-interval">Interval</label>
          <p-datepicker inputId="cerere-interval" formControlName="dates" selectionMode="range"
                        [readonlyInput]="true" [minDate]="today" [disabledDays]="[0, 6]" dateFormat="d M yy"
                        [firstDayOfWeek]="1" appendTo="body" [fluid]="true"
                        [invalid]="submitted() && form.controls.dates.invalid" />
          @if (submitted() && form.controls.dates.invalid) {
            <p class="t-body-sm err">Alege data de început și data de sfârșit.</p>
          } @else {
            <p class="t-body-sm t-muted">Pentru o singură zi, alege aceeași dată de două ori. Weekendurile nu se pot selecta.</p>
          }
          <p class="t-body-sm days" aria-live="polite">
            @switch (days().kind) {
              @case ('loading') { <span class="t-muted">Se calculează zilele lucrătoare...</span> }
              @case ('ok') {
                Zile lucrătoare: <strong class="num">{{ okDays() }}</strong>
              }
              @case ('error') { <span class="err">{{ errorDays() }}</span> }
            }
          </p>
        </div>

        <div class="field">
          <label class="t-label" for="cerere-note">Observații (opțional)</label>
          <textarea pTextarea id="cerere-note" rows="3" formControlName="note" [fluid]="true"
                    [invalid]="form.controls.note.hasError('maxlength')" aria-describedby="cerere-note-ajutor"></textarea>
          <p id="cerere-note-ajutor" class="t-body-sm" [class.err]="form.controls.note.hasError('maxlength')"
             [class.t-muted]="!form.controls.note.hasError('maxlength')">
            @if (form.controls.note.hasError('maxlength')) {
              Observațiile pot avea cel mult {{ noteMax }} de caractere.
            } @else {
              Nu include informații medicale sau alte date sensibile.
            }
            <span class="num count">{{ noteLength() }}/{{ noteMax }}</span>
          </p>
        </div>

        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button label="Trimite cererea" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form { display: grid; gap: var(--space-4); }
    .field { display: grid; gap: var(--space-1); }
    .err { color: var(--danger-ink); }
    .days { min-height: 20px; }
    .count { float: right; }
  `,
})
export class NewLeaveRequestDialog {
  private readonly leave = inject(LeaveService);
  private readonly destroyRef = inject(DestroyRef);

  readonly created = output<void>();
  readonly closed = output<void>();

  protected readonly today = new Date();
  protected readonly noteMax = NOTE_MAX;
  protected readonly typeOptions = (Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((t) => ({
    label: LEAVE_TYPE_LABELS[t],
    value: t,
  }));

  protected readonly form = new FormGroup({
    type: new FormControl<LeaveType | null>(null, Validators.required),
    dates: new FormControl<(Date | null)[] | null>(null, completeRange),
    note: new FormControl('', { nonNullable: true, validators: Validators.maxLength(NOTE_MAX) }),
  });

  protected readonly days = signal<DaysState>({ kind: 'idle' });
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly noteLength = signal(0);

  constructor() {
    this.today.setHours(0, 0, 0, 0);
    this.form.controls.note.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => this.noteLength.set(v.length));

    // Zilele lucrătoare se recalculează live; switchMap anulează cererea anterioară.
    this.form.controls.dates.valueChanges
      .pipe(
        map((v) => (v && v[0] && v[1] ? `${toIsoDate(v[0])}|${toIsoDate(v[1])}` : null)),
        distinctUntilChanged(),
        tap((key) => this.days.set(key ? { kind: 'loading' } : { kind: 'idle' })),
        debounceTime(300),
        switchMap((key) => {
          if (!key) {
            return of<DaysState>({ kind: 'idle' });
          }
          const [start, end] = key.split('|');
          return this.leave.workingDays(start, end).pipe(
            map((r): DaysState => ({ kind: 'ok', days: r.workingDays })),
            catchError((err: unknown) => of<DaysState>({ kind: 'error', message: problemDetail(err) })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.days.set(state));
  }

  protected okDays(): number {
    const d = this.days();
    return d.kind === 'ok' ? d.days : 0;
  }

  protected errorDays(): string {
    const d = this.days();
    return d.kind === 'error' ? d.message : '';
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.busy()) {
      return;
    }
    const { type, dates, note } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.leave
      .create({
        type: type as LeaveType,
        startDate: toIsoDate(dates![0]!),
        endDate: toIsoDate(dates![1]!),
        note: note.trim() ? note.trim() : null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.created.emit();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(problemDetail(err));
        },
      });
  }
}
