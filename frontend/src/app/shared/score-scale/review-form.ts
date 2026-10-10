import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TextareaModule } from 'primeng/textarea';
import { COMMENT_MAX, Criterion, SCALE_MAX } from '../../core/evaluation/evaluation.service';

/** Scală 1-5 pe fiecare criteriu (grup de butoane radio) și comentariu. Doar-citire când `readonly`. */
@Component({
  selector: 'app-review-form',
  imports: [TextareaModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!readonly()) {
      <p class="t-body-sm t-muted">1 = sub așteptări, 5 = peste așteptări</p>
    }
    <div class="criteria">
      @for (c of criteria(); track c.key) {
        <fieldset class="criterion" [class.missing]="showErrors() && !scores()[c.key]">
          <legend class="t-label">{{ c.name }} <span class="t-muted">(pondere {{ c.weight }}%)</span></legend>
          @if (readonly()) {
            <p class="num">{{ scores()[c.key] ? scores()[c.key] + ' din ' + max : 'Necompletat' }}</p>
          } @else {
            <div class="scale" role="radiogroup" [attr.aria-label]="'Scor pentru ' + c.name">
              @for (n of values; track n) {
                <span class="opt">
                  <input type="radio" [id]="idPrefix() + '-' + c.key + '-' + n" [name]="idPrefix() + '-' + c.key"
                         [value]="n" [checked]="scores()[c.key] === n" [disabled]="disabled()"
                         (change)="set(c, n)" />
                  <label [for]="idPrefix() + '-' + c.key + '-' + n" class="num">{{ n }}</label>
                </span>
              }
            </div>
            @if (showErrors() && !scores()[c.key]) {
              <p class="t-body-sm err">Alege un scor de la 1 la {{ max }}.</p>
            }
          }
        </fieldset>
      }
    </div>

    <div class="field">
      <label class="t-label" [for]="idPrefix() + '-comentariu'">Comentariu{{ readonly() ? '' : ' (opțional)' }}</label>
      @if (readonly()) {
        <p [class.t-muted]="!comment()">{{ comment() || 'Fără comentariu.' }}</p>
      } @else {
        <textarea pTextarea [id]="idPrefix() + '-comentariu'" rows="3" [fluid]="true" [value]="comment()"
                  [disabled]="disabled()" [invalid]="tooLong()" [attr.aria-describedby]="idPrefix() + '-comentariu-ajutor'"
                  (input)="comment.set($any($event.target).value)"></textarea>
        <p [id]="idPrefix() + '-comentariu-ajutor'" class="t-body-sm" [class.err]="tooLong()" [class.t-muted]="!tooLong()">
          @if (tooLong()) {
            Comentariul poate avea cel mult {{ commentMax }} de caractere.
          } @else {
            Nu include informații medicale sau alte date sensibile.
          }
          <span class="num count">{{ comment().length }}/{{ commentMax }}</span>
        </p>
      }
    </div>
  `,
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .criteria { display: grid; gap: var(--space-4); }
    .criterion { border: 0; margin: 0; padding: 0; min-width: 0; display: grid; gap: var(--space-2); }
    .criterion p { margin: 0; }
    .criterion legend { padding: 0; margin-bottom: var(--space-2); }
    .scale { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .opt { position: relative; }
    .opt input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; width: 100%; height: 100%; }
    .opt label {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 44px; height: 44px; padding: 0 var(--space-3);
      border: 1px solid var(--border-strong); border-radius: var(--radius-field);
      background: var(--surface); color: var(--ink); font-weight: 600; cursor: pointer;
      transition: background-color var(--motion), border-color var(--motion);
    }
    .opt input:hover + label { border-color: var(--brand); }
    .opt input:checked + label { background: var(--brand); border-color: var(--brand); color: var(--on-brand); }
    .opt input:focus-visible + label { outline: 2px solid var(--brand); outline-offset: 2px; }
    .opt input:disabled + label { opacity: 0.6; cursor: not-allowed; }
    .field { display: grid; gap: var(--space-1); }
    .field p { margin: 0; }
    .err { color: var(--danger-ink); margin: 0; }
    .count { float: right; }
    @media (prefers-reduced-motion: reduce) { .opt label { transition: none; } }
  `,
})
export class ReviewForm {
  readonly criteria = input.required<Criterion[]>();
  readonly idPrefix = input.required<string>();
  readonly scores = model<Record<string, number>>({});
  readonly comment = model<string>('');
  readonly readonly = input(false);
  readonly disabled = input(false);
  readonly showErrors = input(false);

  protected readonly max = SCALE_MAX;
  protected readonly commentMax = COMMENT_MAX;
  protected readonly values = Array.from({ length: SCALE_MAX }, (_, i) => i + 1);
  protected readonly tooLong = computed(() => this.comment().length > COMMENT_MAX);

  protected set(c: Criterion, n: number): void {
    this.scores.set({ ...this.scores(), [c.key]: n });
  }
}

/** Toate criteriile au scor și comentariul încape în limită. */
export function reviewValid(criteria: Criterion[], scores: Record<string, number>, comment: string): boolean {
  return criteria.every((c) => scores[c.key] >= 1 && scores[c.key] <= SCALE_MAX) && comment.length <= COMMENT_MAX;
}
