import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { SelectModule } from 'primeng/select';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermissionDirective } from '../../core/auth/has-permission.directive';
import { ThemeChoice, ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, FormsModule, ButtonModule, DrawerModule, SelectModule,
    HasPermissionDirective, NgTemplateOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);

  protected readonly drawerOpen = signal(false);
  protected readonly companyName = computed(() => this.auth.user()?.company.name ?? 'Smart HR');
  protected readonly email = computed(() => this.auth.user()?.user.email ?? '');

  protected readonly themes: { label: string; value: ThemeChoice }[] = [
    { label: 'Luminos', value: 'light' },
    { label: 'Întunecat', value: 'dark' },
  ];

  protected setTheme(value: ThemeChoice): void {
    this.theme.set(value);
  }

  protected logout(): void {
    this.auth.logout();
  }
}
