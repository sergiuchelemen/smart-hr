import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { AdminRole } from '../../../core/admin/admin.service';

/** Selecție multiplă de roluri; rolurile pe care apelantul nu le poate atribui sunt dezactivate, cu explicație. */
@Component({
  selector: 'app-role-picker',
  imports: [FormsModule, CheckboxModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (roles().length === 0) {
      <p class="t-body-sm t-muted">Nu există roluri. Creează unul în pagina Roluri și privilegii.</p>
    } @else {
      <ul class="list" role="group" [attr.aria-labelledby]="labelId()">
        @for (r of roles(); track r.id) {
          <li class="item">
            <p-checkbox [inputId]="idPrefix() + r.id" [binary]="true" [disabled]="!r.assignable"
                        [ngModel]="selectedSet().has(r.id)" (ngModelChange)="toggle(r.id, $event)"
                        [attr.data-role]="r.id" />
            <div class="text">
              <label [for]="idPrefix() + r.id">{{ r.name }}</label>
              @if (!r.assignable) {
                <span class="t-body-sm t-muted">Rolul are privilegii pe care tu nu le deții, deci nu îl poți atribui.</span>
              }
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); max-height: 16rem; overflow-y: auto; }
    .item { display: flex; gap: var(--space-3); align-items: flex-start; min-height: 36px; padding: var(--space-1) 0; }
    .text { display: grid; }
    label { cursor: pointer; }
  `,
})
export class RolePicker {
  readonly roles = input.required<AdminRole[]>();
  readonly idPrefix = input('rol-');
  readonly labelId = input.required<string>();
  readonly selected = model<string[]>([]);

  protected readonly selectedSet = computed(() => new Set(this.selected()));

  protected toggle(id: string, checked: boolean): void {
    const next = new Set(this.selected());
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selected.set([...next]);
  }
}
