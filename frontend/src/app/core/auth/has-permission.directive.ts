import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from './auth.service';

/** Utilizare: <li *appHasPermission="'EMPLOYEE_READ'"> (un cod sau o listă; sunt necesare toate). */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  private readonly auth = inject(AuthService);
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private shown = false;

  readonly appHasPermission = input.required<string | readonly string[]>();

  constructor() {
    effect(() => {
      const needed = this.appHasPermission();
      const list = typeof needed === 'string' ? [needed] : needed;
      const allowed = this.auth.hasAll(list);
      if (allowed && !this.shown) {
        this.vcr.createEmbeddedView(this.tpl);
        this.shown = true;
      } else if (!allowed && this.shown) {
        this.vcr.clear();
        this.shown = false;
      }
    });
  }
}
