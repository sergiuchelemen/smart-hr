import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AdminRole, AdminService, AdminUser } from '../../../core/admin/admin.service';
import { problemDetail } from '../../../core/leave/leave.service';
import { PasswordInput, passwordValidator } from '../../../shared/password-input/password-input';
import { RolePicker } from './role-picker';

const DIALOG_STYLES = `
  .form { display: grid; gap: var(--space-4); }
  .field { display: grid; gap: var(--space-1); }
  .err { color: var(--danger-ink); }
  .roles-box { border: 1px solid var(--border); border-radius: var(--radius-field); padding: var(--space-3) var(--space-4); }
`;

/** Utilizator nou: e-mail, parolă și roluri. Parola nu se mai afișează după salvare. */
@Component({
  selector: 'app-user-create-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, InputTextModule, MessageModule, PasswordInput, RolePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" header="Utilizator nou"
              [style]="{ width: '36rem' }" [breakpoints]="{ '640px': '94vw' }">
      <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="field">
          <label class="t-label" for="nou-email">E-mail</label>
          <input pInputText id="nou-email" type="email" formControlName="email" autocomplete="off" maxlength="254"
                 [attr.aria-invalid]="submitted() && form.controls.email.invalid ? 'true' : null"
                 aria-describedby="nou-email-ajutor" />
          <p id="nou-email-ajutor" class="t-body-sm" [class.err]="submitted() && form.controls.email.invalid"
             [class.t-muted]="!(submitted() && form.controls.email.invalid)">
            @if (submitted() && form.controls.email.invalid) {
              Introdu o adresă de e-mail validă.
            } @else {
              Adresa cu care utilizatorul se autentifică.
            }
          </p>
        </div>

        <div class="field">
          <label class="t-label" for="nou-parola">Parolă</label>
          <app-password-input inputId="nou-parola" formControlName="password"
                              [invalid]="submitted() && form.controls.password.invalid"
                              describedBy="nou-parola-ajutor" />
          <p id="nou-parola-ajutor" class="t-body-sm" [class.err]="submitted() && form.controls.password.invalid"
             [class.t-muted]="!(submitted() && form.controls.password.invalid)">
            @if (submitted() && form.controls.password.hasError('maxbytes')) {
              Parola poate avea cel mult 72 de octeți.
            } @else if (submitted() && form.controls.password.invalid) {
              Parola trebuie să aibă cel puțin 12 caractere.
            } @else {
              Cel puțin 12 caractere. Comunică-o utilizatorului pe un canal sigur; nu va mai fi afișată după salvare.
            }
          </p>
        </div>

        <div class="field">
          <span class="t-label" id="nou-roluri">Roluri</span>
          <div class="roles-box">
            <app-role-picker labelId="nou-roluri" idPrefix="nou-rol-" [roles]="roles()" [(selected)]="roleIds" />
          </div>
          <p class="t-body-sm t-muted">Fără niciun rol, utilizatorul nu are acces la nicio secțiune.</p>
        </div>

        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button label="Creează utilizatorul" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: DIALOG_STYLES,
})
export class UserCreateDialog {
  private readonly admin = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly roles = input.required<AdminRole[]>();
  readonly closed = output<boolean>();

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    password: new FormControl('', { nonNullable: true, validators: [passwordValidator] }),
  });
  protected readonly roleIds = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  private dirty = false;

  protected close(): void {
    if (!this.busy()) {
      this.form.controls.password.reset('');
      this.closed.emit(this.dirty);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid || this.busy()) {
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    this.admin
      .createUser({ email: email.trim(), password, roleIds: this.roleIds() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.form.controls.password.reset('');
          this.dirty = true;
          this.closed.emit(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.dirty = true;
          this.error.set(problemDetail(err));
        },
      });
  }
}

/** Modifică rolurile unui utilizator existent. */
@Component({
  selector: 'app-user-roles-dialog',
  imports: [ButtonModule, DialogModule, MessageModule, RolePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" header="Roluri utilizator"
              [style]="{ width: '34rem' }" [breakpoints]="{ '640px': '94vw' }">
      <div class="form">
        <p>Alege rolurile pentru <strong>{{ user().email }}</strong>. Schimbarea are efect imediat.</p>
        <div class="field">
          <span class="t-label" id="roluri-user">Roluri</span>
          <div class="roles-box">
            <app-role-picker labelId="roluri-user" idPrefix="edit-rol-" [roles]="roles()" [(selected)]="roleIds" />
          </div>
        </div>
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </div>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        <p-button label="Salvează rolurile" [loading]="busy()" (onClick)="submit()" />
      </ng-template>
    </p-dialog>
  `,
  styles: DIALOG_STYLES,
})
export class UserRolesDialog implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = input.required<AdminUser>();
  readonly roles = input.required<AdminRole[]>();
  readonly closed = output<boolean>();

  protected readonly roleIds = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private dirty = false;

  ngOnInit(): void {
    this.roleIds.set(this.user().roles.map((r) => r.id));
  }

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(this.dirty);
    }
  }

  protected submit(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.admin
      .setUserRoles(this.user().id, this.roleIds())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.closed.emit(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.dirty = true;
          this.error.set(problemDetail(err));
        },
      });
  }
}

/** Resetare de parolă. După salvare parola este golită din câmp și nu se mai afișează. */
@Component({
  selector: 'app-user-password-dialog',
  imports: [ReactiveFormsModule, ButtonModule, DialogModule, MessageModule, PasswordInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" header="Resetează parola"
              [style]="{ width: '36rem' }" [breakpoints]="{ '640px': '94vw' }">
      @if (done()) {
        <p-message severity="success" role="status">
          Parola a fost schimbată. Utilizatorul va trebui să se autentifice din nou.
        </p-message>
      } @else {
        <form class="form" (submit)="$event.preventDefault(); submit()" novalidate>
          <p>Setează o parolă nouă pentru <strong>{{ user().email }}</strong>.</p>
          <div class="field">
            <label class="t-label" for="reset-parola">Parolă nouă</label>
            <app-password-input inputId="reset-parola" [formControl]="password"
                                [invalid]="submitted() && password.invalid" describedBy="reset-parola-ajutor" />
            <p id="reset-parola-ajutor" class="t-body-sm" [class.err]="submitted() && password.invalid"
               [class.t-muted]="!(submitted() && password.invalid)">
              @if (submitted() && password.hasError('maxbytes')) {
                Parola poate avea cel mult 72 de octeți.
              } @else if (submitted() && password.invalid) {
                Parola trebuie să aibă cel puțin 12 caractere.
              } @else {
                Cel puțin 12 caractere. Comunică-o utilizatorului pe un canal sigur; nu va mai fi afișată după salvare.
              }
            </p>
          </div>
          @if (error()) {
            <p-message severity="error" role="alert">{{ error() }}</p-message>
          }
        </form>
      }
      <ng-template #footer>
        @if (done()) {
          <p-button label="Închide" (onClick)="close()" />
        } @else {
          <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
          <p-button label="Schimbă parola" [loading]="busy()" (onClick)="submit()" />
        }
      </ng-template>
    </p-dialog>
  `,
  styles: DIALOG_STYLES,
})
export class UserPasswordDialog {
  private readonly admin = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = input.required<AdminUser>();
  readonly closed = output<boolean>();

  protected readonly password = new FormControl('', { nonNullable: true, validators: [passwordValidator] });
  protected readonly busy = signal(false);
  protected readonly submitted = signal(false);
  protected readonly error = signal('');
  protected readonly done = signal(false);

  protected close(): void {
    if (!this.busy()) {
      this.password.reset('');
      this.closed.emit(false);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.password.invalid || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.admin
      .setUserPassword(this.user().id, this.password.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.password.reset('');
          this.done.set(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(problemDetail(err));
        },
      });
  }
}

/** Confirmare pentru dezactivare sau activare; butonul periculos apare doar la dezactivare. */
@Component({
  selector: 'app-user-enabled-dialog',
  imports: [ButtonModule, DialogModule, MessageModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog [visible]="true" (visibleChange)="$event || close()" [modal]="true" [draggable]="false"
              [resizable]="false" [closable]="!busy()" [header]="enable() ? 'Activează contul' : 'Dezactivează contul'"
              [style]="{ width: '32rem' }" [breakpoints]="{ '640px': '94vw' }">
      <div class="form">
        @if (enable()) {
          <p>Contul <strong>{{ user().email }}</strong> va putea din nou să se autentifice.</p>
        } @else {
          <p>
            Contul <strong>{{ user().email }}</strong> nu se va mai putea autentifica, iar sesiunile deschise se închid.
            Îl poți activa din nou oricând.
          </p>
        }
        @if (error()) {
          <p-message severity="error" role="alert">{{ error() }}</p-message>
        }
      </div>
      <ng-template #footer>
        <p-button label="Renunță" severity="secondary" [text]="true" [disabled]="busy()" (onClick)="close()" />
        @if (enable()) {
          <p-button label="Activează" [loading]="busy()" (onClick)="submit()" />
        } @else {
          <p-button label="Dezactivează" severity="danger" [loading]="busy()" (onClick)="submit()" />
        }
      </ng-template>
    </p-dialog>
  `,
  styles: DIALOG_STYLES,
})
export class UserEnabledDialog {
  private readonly admin = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = input.required<AdminUser>();
  readonly enable = input.required<boolean>();
  readonly closed = output<boolean>();

  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private dirty = false;

  protected close(): void {
    if (!this.busy()) {
      this.closed.emit(this.dirty);
    }
  }

  protected submit(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.admin
      .setUserEnabled(this.user().id, this.enable())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.closed.emit(true);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.dirty = true;
          this.error.set(problemDetail(err));
        },
      });
  }
}
