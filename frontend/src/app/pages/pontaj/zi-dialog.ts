import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { problemDetail } from '../../core/leave/leave.service';
import {
  ENTRY_TYPE_LABELS,
  EntryType,
  TimesheetDay,
  TimesheetService,
} from '../../core/timesheet/timesheet.service';
import { formatDate } from '../../shared/format/date';

const NOTE_MAX = 200;
const MAX_MINUTES = 960;

function withinDay(group: { value: { hours: number | null; minutes: number | null } }): ValidationErrors | null {
  const { hours, minutes } = group.value;
  return (hours ?? 0) * 60 + (minutes ?? 0) > MAX_MINUTES ? { total: true } : null;
}

@Component({
  selector: 'app-zi-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputNumberModule, MessageModule, SelectModule, TextareaModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" [header]="title()"
              [style]="{ width: '30rem' }" [breakpoints]="{ '640px': '94vw' }">
      <form class="form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <div class="time">
          <div class="field">
            <label class="t-label" for="zi-ore">Ore</label>
            <p-inputnumber inputId="zi-ore" formControlName="hours" [min]="0" [max]="16" [showButtons]="false"
                           [useGrouping]="false" [fluid]="true" [invalid]="submitted() && invalidTime()" />
          </div>
          <div class="field">
            <label class="t-label" for="zi-minute">Minute</label>
            <p-inputnumber inputId="zi-minute" formControlName="minutes" [min]="0" [max]="59" [showButtons]="false"
                           [useGrouping]="false" [fluid]="true" [invalid]="submitted() && invalidTime()" />
          </div>
        </div>
        <p class="t-body-sm" [class.err]="submitted() && invalidTime()" [class.t-muted]="!(submitted() && invalidTime())">
          @if (submitted() && invalidTime()) {
            Introdu între 0 și 16 ore, 0 și 59 minute, cel mult 16 ore pe zi.
          } @else {
            Cel mult 16 ore pe zi.
          }
        </p>

        <div class="field">
          <label class="t-label" for="zi-tip">Tip</label>
          <p-select inputId="zi-tip" formControlName="type" [options]="typeOptions" optionLabel="label"
                    optionValue="value" appendTo="body" [fluid]="true" />
        </div>

        <div class="field">
          <label class="t-label" for="zi-note">Observații (opțional)</label>
          <textarea pTextarea id="zi-note" rows="3" formControlName="note" [fluid]="true"
                    [invalid]="form.controls.note.hasError('maxlength')" aria-describedby="zi-note-ajutor"></textarea>
          <p id="zi-note-ajutor" class="t-body-sm" [class.err]="form.controls.note.hasError('maxlength')"
             [class.t-muted]="!form.controls.note.hasError('maxlength')">
            @if (form.controls.note.hasError('maxlength')) {
              Observațiile pot avea cel mult {{ noteMax }} de caractere.
            } @else {
              Nu include informații medicale sau alte date sensibile.
            }
            <span class="num count">{{ noteLength() }}/{{ noteMax }}</span>
          </p>
        </div>

        @if (confirmDelete()) {
          <p-message severity="warn" role="alert">
            Ștergi pontajul pentru {{ dateLabel() }}? Acțiunea nu poate fi anulată.
            <span class="confirm-actions">
              <p-button label="Renunță" severity="secondary" [text]="true" size="small" [disabled]="busy()"
                        (onClick)="confirmDelete.set(false)" />
              <p-button label="Șterge ziua" severity="danger" size="small" [loading]="busy()" (onClick)="remove()" />
            </span>
          </p-message>
        }
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        @if (entry()?.minutes != null && !confirmDelete()) {
          <p-button class="delete" label="Șterge ziua" severity="secondary" [outlined]="true" [disabled]="busy()"
                    (onClick)="confirmDelete.set(true)" />
        }
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button label="Salvează" [loading]="busy()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .form { display: grid; gap: var(--space-3); }
    .time { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
    .field { display: grid; gap: var(--space-1); }
    .err { color: var(--danger-ink); }
    .count { float: right; }
    .confirm-actions { display: inline-flex; gap: var(--space-2); margin-left: var(--space-3); }
    .delete { margin-right: auto; }
  `,
})
export class ZiDialog implements OnInit {
  private readonly timesheet = inject(TimesheetService);
  private readonly destroyRef = inject(DestroyRef);

  readonly date = input.required<string>();
  readonly entry = input<TimesheetDay | null>(null);
  readonly changed = output<void>();
  readonly closed = output<void>();

  protected readonly noteMax = NOTE_MAX;
  protected readonly typeOptions = (Object.keys(ENTRY_TYPE_LABELS) as EntryType[]).map((t) => ({
    label: ENTRY_TYPE_LABELS[t],
    value: t,
  }));
  protected readonly form = new FormGroup(
    {
      hours: new FormControl<number | null>(8, [Validators.required, Validators.min(0), Validators.max(16)]),
      minutes: new FormControl<number | null>(0, [Validators.required, Validators.min(0), Validators.max(59)]),
      type: new FormControl<EntryType>('LUCRAT', { nonNullable: true }),
      note: new FormControl('', { nonNullable: true, validators: Validators.maxLength(NOTE_MAX) }),
    },
    { validators: withinDay },
  );
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly noteLength = signal(0);
  protected readonly confirmDelete = signal(false);
  protected readonly dateLabel = computed(() => formatDate(this.date()));
  protected readonly title = computed(() => `Ziua de ${this.dateLabel()}`);

  constructor() {
    this.form.controls.note.valueChanges.pipe(takeUntilDestroyed()).subscribe((v) => this.noteLength.set(v.length));
  }

  ngOnInit(): void {
    const e = this.entry();
    if (e && e.minutes !== null && e.type) {
      this.form.patchValue({
        hours: Math.floor(e.minutes / 60),
        minutes: e.minutes % 60,
        type: e.type,
        note: e.note ?? '',
      });
    }
  }

  protected invalidTime(): boolean {
    return this.form.controls.hours.invalid || this.form.controls.minutes.invalid || this.form.hasError('total');
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  protected save(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.busy()) {
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.timesheet
      .save([{ date: this.date(), minutes: (v.hours ?? 0) * 60 + (v.minutes ?? 0), type: v.type, note: v.note.trim() || null }])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.changed.emit();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(problemDetail(err));
        },
      });
  }

  protected remove(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.timesheet
      .deleteDay(this.date())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.changed.emit();
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.confirmDelete.set(false);
          this.error.set(problemDetail(err));
        },
      });
  }
}
