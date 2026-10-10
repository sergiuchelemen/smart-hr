import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { AdminService, AdminUser } from '../../core/admin/admin.service';
import { Employee, EmployeesService } from '../../core/employees/employees.service';
import { problemDetail } from '../../core/leave/leave.service';
import { toIsoDate } from '../../shared/format/date';

const DIALOG_STYLES = `
  .form { display: grid; gap: var(--space-4); }
  .field { display: grid; gap: var(--space-1); }
  .err { color: var(--danger-ink); }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
  @media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
`;

export function employeeName(e: Pick<Employee, 'firstName' | 'lastName'>): string {
  return `${e.firstName} ${e.lastName}`;
}

const MIN_HIRE = new Date(1900, 0, 1);

function maxHire(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

function notBlank(c: AbstractControl<string>): ValidationErrors | null {
  return c.value.trim() ? null : { required: true };
}

function hireRange(c: AbstractControl<Date | null>): ValidationErrors | null {
  const v = c.value;
  if (!v) {
    return null;
  }
  return v >= MIN_HIRE && v <= maxHire() ? null : { range: true };
}

/** Angajat nou / Editează angajatul. Fără CNP sau salariu. */
@Component({
  selector: 'app-employee-form-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DatePickerModule, DialogModule, InputTextModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" [header]="employee() ? 'Editează angajatul' : 'Angajat nou'"
              [style]="{ width: '38rem' }" [breakpoints]="{ '640px': '94vw' }">
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="row">
          <div class="field">
            <label class="t-label" for="ang-prenume">Prenume</label>
            <input pInputText id="ang-prenume" formControlName="firstName" maxlength="100" autocomplete="off"
                   [attr.aria-invalid]="show('firstName') ? 'true' : null" aria-describedby="ang-prenume-err" />
            <p id="ang-prenume-err" class="t-body-sm err">
              @if (show('firstName')) { Introdu prenumele (cel mult 100 de caractere). }
            </p>
          </div>
          <div class="field">
            <label class="t-label" for="ang-nume">Nume</label>
            <input pInputText id="ang-nume" formControlName="lastName" maxlength="100" autocomplete="off"
                   [attr.aria-invalid]="show('lastName') ? 'true' : null" aria-describedby="ang-nume-err" />
            <p id="ang-nume-err" class="t-body-sm err">
              @if (show('lastName')) { Introdu numele (cel mult 100 de caractere). }
            </p>
          </div>
        </div>

        <div class="field">
          <label class="t-label" for="ang-email">E-mail de serviciu (opțional)</label>
          <input pInputText id="ang-email" type="email" formControlName="workEmail" maxlength="254" autocomplete="off"
                 [attr.aria-invalid]="show('workEmail') ? 'true' : null" aria-describedby="ang-email-ajutor" />
          <p id="ang-email-ajutor" class="t-body-sm" [class.err]="show('workEmail')" [class.t-muted]="!show('workEmail')">
            @if (show('workEmail')) { Introdu o adresă de e-mail validă. } @else { Adresa trebuie să fie unică în companie. }
          </p>
        </div>

        <div class="row">
          <div class="field">
            <label class="t-label" for="ang-functie">Funcție (opțional)</label>
            <input pInputText id="ang-functie" formControlName="jobTitle" maxlength="150" autocomplete="off" />
          </div>
          <div class="field">
            <label class="t-label" for="ang-dep">Departament (opțional)</label>
            <input pInputText id="ang-dep" formControlName="department" maxlength="150" autocomplete="off" />
          </div>
        </div>

        <div class="field">
          <label class="t-label" for="ang-data">Data angajării (opțional)</label>
          <p-datepicker inputId="ang-data" formControlName="hireDate" dateFormat="dd.mm.yy" [showIcon]="true"
                        [minDate]="minDate" [maxDate]="maxDate" [firstDayOfWeek]="1" appendTo="body" [fluid]="true"
                        [invalid]="show('hireDate')" [defaultDate]="today" />
          <p class="t-body-sm" [class.err]="show('hireDate')" [class.t-muted]="!show('hireDate')">
            @if (show('hireDate')) {
              Data trebuie să fie între 01.01.1900 și cel mult un an în viitor.
            } @else {
              Format zz.ll.aaaa.
            }
          </p>
        </div>

        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button [label]="employee() ? 'Salvează' : 'Adaugă angajatul'" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: DIALOG_STYLES,
})
export class EmployeeFormDialog implements OnInit {
  private readonly api = inject(EmployeesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly employee = input<Employee | null>(null);
  readonly closed = output<boolean>();

  protected readonly today = new Date();
  protected readonly minDate = MIN_HIRE;
  protected readonly maxDate = maxHire();
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');

  protected readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [notBlank, Validators.maxLength(100)] }),
    lastName: new FormControl('', { nonNullable: true, validators: [notBlank, Validators.maxLength(100)] }),
    workEmail: new FormControl('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(254)] }),
    jobTitle: new FormControl('', { nonNullable: true, validators: Validators.maxLength(150) }),
    department: new FormControl('', { nonNullable: true, validators: Validators.maxLength(150) }),
    hireDate: new FormControl<Date | null>(null, hireRange),
  });

  ngOnInit(): void {
    const e = this.employee();
    if (e) {
      let hire: Date | null = null;
      if (e.hireDate) {
        const [y, m, d] = e.hireDate.split('-').map(Number);
        hire = new Date(y, m - 1, d);
      }
      this.form.setValue({
        firstName: e.firstName,
        lastName: e.lastName,
        workEmail: e.workEmail ?? '',
        jobTitle: e.jobTitle ?? '',
        department: e.department ?? '',
        hireDate: hire,
      });
    }
  }

  protected show(name: keyof typeof this.form.controls): boolean {
    return this.submitted() && this.form.controls[name].invalid;
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(false);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.busy()) {
      return;
    }
    const v = this.form.getRawValue();
    const opt = (s: string): string | null => (s.trim() ? s.trim() : null);
    const body = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      workEmail: opt(v.workEmail),
      jobTitle: opt(v.jobTitle),
      department: opt(v.department),
      hireDate: v.hireDate ? toIsoDate(v.hireDate) : null,
    };
    const e = this.employee();
    this.busy.set(true);
    this.error.set('');
    (e ? this.api.update(e.id, body) : this.api.create(body))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.closed.emit(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(problemDetail(err));
        },
      });
  }
}

type LoadState = 'loading' | 'ready' | 'error';

/** Leagă sau dezleagă contul de utilizator al angajatului. */
@Component({
  selector: 'app-employee-account-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, MessageModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" header="Contul angajatului"
              [style]="{ width: '34rem' }" [breakpoints]="{ '640px': '94vw' }">
      <div class="form">
        <p>Angajat: <strong>{{ name() }}</strong></p>
        @if (state() === 'loading') {
          <p class="t-muted" aria-live="polite">Se încarcă conturile...</p>
        } @else if (state() === 'error') {
          <p-message severity="error" role="alert">{{ loadError() }}</p-message>
        } @else if (confirmingUnlink()) {
          <p-message severity="warn">
            Contul <strong>{{ linkedEmail() }}</strong> nu va mai fi asociat cu {{ name() }}. Angajatul nu își va mai putea depune cereri de concediu.
          </p-message>
        } @else {
          <p>
            Cont legat:
            @if (employee().userId) { <strong>{{ linkedEmail() }}</strong> } @else { <span class="t-muted">Niciun cont</span> }
          </p>
          @if (!employee().userId) {
            <div class="field">
              <label class="t-label" for="cont-select">Cont de utilizator</label>
              <p-select inputId="cont-select" [formControl]="choice" [options]="options()" optionLabel="email"
                        optionValue="id" placeholder="Alege un cont" appendTo="body" [fluid]="true" [filter]="options().length > 8"
                        filterBy="email" emptyMessage="Niciun cont disponibil" [showClear]="true" />
              <p class="t-body-sm t-muted">Contul permite angajatului să își depună cereri de concediu.</p>
            </div>
          } @else {
            <p class="t-body-sm t-muted">Contul permite angajatului să își depună cereri de concediu.</p>
          }
        }
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </div>
      <ng-template #footer>
        @if (confirmingUnlink()) {
          <p-button label="Înapoi" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="confirmingUnlink.set(false)" />
          <p-button label="Dezleagă contul" severity="danger" [loading]="busy()" (onClick)="save(null)" />
        } @else {
          <p-button label="Închide" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
          @if (state() === 'ready') {
            @if (employee().userId) {
              <p-button label="Dezleagă contul" severity="danger" [outlined]="true" (onClick)="confirmingUnlink.set(true); error.set('')" />
            } @else {
              <p-button label="Leagă contul" [loading]="busy()" [disabled]="!choice.value" (onClick)="save(choice.value)" />
            }
          }
        }
      </ng-template>
    </p-dialog>
  `,
  styles: DIALOG_STYLES,
})
export class EmployeeAccountDialog implements OnInit {
  private readonly api = inject(EmployeesService);
  private readonly admin = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly employee = input.required<Employee>();
  /** Toți angajații, pentru a exclude conturile deja legate de alții. */
  readonly directory = input.required<Employee[]>();
  readonly closed = output<boolean>();

  protected readonly choice = new FormControl<string | null>(null);
  protected readonly state = signal<LoadState>('loading');
  protected readonly loadError = signal('');
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly confirmingUnlink = signal(false);
  private dirty = false;

  protected readonly name = computed(() => employeeName(this.employee()));
  protected readonly linkedEmail = computed(
    () => this.users().find((u) => u.id === this.employee().userId)?.email ?? 'cont legat',
  );
  protected readonly options = computed(() => {
    const taken = new Set(this.directory().map((e) => e.userId).filter((u): u is string => !!u));
    return this.users().filter((u) => u.enabled && !taken.has(u.id));
  });

  ngOnInit(): void {
    this.admin
      .users()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (u) => {
          this.users.set(u);
          this.state.set('ready');
        },
        error: (err: unknown) => {
          this.loadError.set(problemDetail(err));
          this.state.set('error');
        },
      });
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(this.dirty);
    }
  }

  protected save(userId: string | null): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .setAccount(this.employee().id, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.closed.emit(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.confirmingUnlink.set(false);
          this.error.set(problemDetail(err));
        },
      });
  }
}

/** Alege managerul direct sau scoate managerul. */
@Component({
  selector: 'app-employee-manager-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, MessageModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" header="Managerul angajatului"
              [style]="{ width: '34rem' }" [breakpoints]="{ '640px': '94vw' }">
      <div class="form">
        <p>Angajat: <strong>{{ name() }}</strong></p>
        <div class="field">
          <label class="t-label" for="mgr-select">Manager direct</label>
          <p-select inputId="mgr-select" [formControl]="choice" [options]="options()" optionLabel="label"
                    optionValue="id" appendTo="body" [fluid]="true" [filter]="true" filterBy="label"
                    filterPlaceholder="Caută după nume" emptyMessage="Niciun angajat găsit" />
          <p class="t-body-sm t-muted">Managerul direct aprobă cererile de concediu ale angajatului.</p>
        </div>
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </div>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button label="Salvează" [loading]="busy()" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: DIALOG_STYLES,
})
export class EmployeeManagerDialog implements OnInit {
  private readonly api = inject(EmployeesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly employee = input.required<Employee>();
  readonly directory = input.required<Employee[]>();
  readonly closed = output<boolean>();

  protected readonly choice = new FormControl<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly name = computed(() => employeeName(this.employee()));
  protected readonly options = computed(() => [
    { id: null as string | null, label: 'Fără manager' },
    ...this.directory()
      .filter((e) => e.id !== this.employee().id)
      .map((e) => ({ id: e.id as string | null, label: employeeName(e) })),
  ]);

  ngOnInit(): void {
    this.choice.setValue(this.employee().managerId);
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(false);
    }
  }

  protected save(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api
      .setManager(this.employee().id, this.choice.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.closed.emit(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(problemDetail(err));
        },
      });
  }
}

function wholeDays(c: AbstractControl<number | null>): ValidationErrors | null {
  const v = c.value;
  if (v === null || v === undefined) {
    return { required: true };
  }
  return Number.isInteger(v) && v >= 0 && v <= 100 ? null : { range: true };
}

/** Soldul de concediu pe an: zile acordate și reportate. */
@Component({
  selector: 'app-employee-balance-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputNumberModule, MessageModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" header="Soldul de concediu"
              [style]="{ width: '34rem' }" [breakpoints]="{ '640px': '94vw' }">
      <form class="form" [formGroup]="form" (ngSubmit)="save()" novalidate>
        <p>Angajat: <strong>{{ name() }}</strong></p>
        <div class="field">
          <label class="t-label" for="sold-an">An</label>
          <p-select inputId="sold-an" [formControl]="year" [options]="years" appendTo="body" [fluid]="true"
                    (onChange)="loadYear()" />
        </div>
        @if (state() === 'loading') {
          <p class="t-muted" aria-live="polite">Se încarcă soldul...</p>
        } @else if (state() === 'error') {
          <p-message severity="error" role="alert">{{ loadError() }}</p-message>
          <div><p-button label="Încearcă din nou" severity="secondary" [outlined]="true" (onClick)="loadYear()" /></div>
        } @else {
          <div class="row">
            <div class="field">
              <label class="t-label" for="sold-acordate">Zile acordate</label>
              <p-inputnumber inputId="sold-acordate" formControlName="entitledDays" [min]="0" [max]="100"
                             [useGrouping]="false" [maxFractionDigits]="0" [fluid]="true"
                             [invalid]="show('entitledDays')" />
              <p class="t-body-sm" [class.err]="show('entitledDays')" [class.t-muted]="!show('entitledDays')">
                @if (show('entitledDays')) { Introdu un număr întreg între 0 și 100. } @else { Între 0 și 100. }
              </p>
            </div>
            <div class="field">
              <label class="t-label" for="sold-reportate">Zile reportate</label>
              <p-inputnumber inputId="sold-reportate" formControlName="carriedOverDays" [min]="0" [max]="100"
                             [useGrouping]="false" [maxFractionDigits]="0" [fluid]="true"
                             [invalid]="show('carriedOverDays')" />
              <p class="t-body-sm" [class.err]="show('carriedOverDays')" [class.t-muted]="!show('carriedOverDays')">
                @if (show('carriedOverDays')) { Introdu un număr întreg între 0 și 100. } @else { Din anul precedent. }
              </p>
            </div>
          </div>
          <p class="t-body-sm t-muted">
            Zile folosite în {{ year.value }}: <strong class="num">{{ used() }}</strong>.
            Totalul nu poate fi mai mic decât zilele folosite.
          </p>
        }
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button label="Salvează soldul" [loading]="busy()" [disabled]="state() !== 'ready'" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
  styles: DIALOG_STYLES,
})
export class EmployeeBalanceDialog implements OnInit {
  private readonly api = inject(EmployeesService);
  private readonly destroyRef = inject(DestroyRef);
  private seq = 0;

  readonly employee = input.required<Employee>();
  readonly closed = output<boolean>();

  private readonly thisYear = new Date().getFullYear();
  protected readonly years = [this.thisYear - 1, this.thisYear, this.thisYear + 1];
  protected readonly year = new FormControl(this.thisYear, { nonNullable: true });
  protected readonly form = new FormGroup({
    entitledDays: new FormControl<number | null>(null, wholeDays),
    carriedOverDays: new FormControl<number | null>(null, wholeDays),
  });
  protected readonly state = signal<LoadState>('loading');
  protected readonly loadError = signal('');
  protected readonly used = signal(0);
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');

  protected readonly name = computed(() => employeeName(this.employee()));

  ngOnInit(): void {
    this.loadYear();
  }

  protected show(name: 'entitledDays' | 'carriedOverDays'): boolean {
    return this.submitted() && this.form.controls[name].invalid;
  }

  protected loadYear(): void {
    const seq = ++this.seq;
    this.state.set('loading');
    this.error.set('');
    this.submitted.set(false);
    this.api
      .balance(this.employee().id, this.year.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (b) => {
          if (seq !== this.seq) {
            return;
          }
          this.form.setValue({ entitledDays: b.entitled, carriedOverDays: b.carriedOver });
          this.used.set(b.used);
          this.state.set('ready');
        },
        error: (err: unknown) => {
          if (seq !== this.seq) {
            return;
          }
          this.loadError.set(problemDetail(err));
          this.state.set('error');
        },
      });
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(false);
    }
  }

  protected save(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.busy() || this.state() !== 'ready') {
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.api
      .setBalance(this.employee().id, this.year.value, v.entitledDays!, v.carriedOverDays!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.closed.emit(false);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(problemDetail(err));
        },
      });
  }
}
