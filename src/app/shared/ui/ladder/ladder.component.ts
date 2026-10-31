import { Component, input } from '@angular/core';
import { LadderStep } from '../../../core/stores/live-tournament.store';
import { IconComponent } from '../icon/icon.component';

const STATE_LABELS: Record<LadderStep['state'], string> = {
  done: 'JOGADO',
  now: 'AGORA',
  next: 'A SEGUIR',
  later: 'DEPOIS',
};

/**
 * A chave em escada: um degrau por partida, com o trilho à esquerda e o estado
 * de cada uma. O último nó é o campeão.
 */
@Component({
  selector: 'app-ladder',
  imports: [IconComponent],
  template: `
    @for (step of steps(); track $index) {
      <div class="grid grid-cols-[22px_1fr] gap-2">
        <div class="flex flex-col items-center pt-3">
          <span
            class="size-[11px] shrink-0 border border-accent"
            [class.bg-accent]="step.state === 'now'"
            aria-hidden="true"
          ></span>
          <span class="w-px flex-1 bg-divider" aria-hidden="true"></span>
        </div>

        <div
          class="mb-3 border"
          [class]="step.state === 'now' ? 'border-accent' : 'border-divider'"
        >
          <div class="flex items-center justify-between gap-2 px-3 pt-2">
            <span class="text-[12px] font-semibold tracking-[0.04em] uppercase text-accent-700">
              {{ step.phaseLabel }}
            </span>
            <span class="tag" [class]="stateClass(step)">{{ stateLabel(step) }}</span>
          </div>

          @for (side of [step.a, step.b]; track $index) {
            <div class="flex items-baseline gap-2 px-3 py-2" [class.bg-accent-100]="side.isMine">
              <span
                class="min-w-0 flex-1 font-heading text-[17px] leading-tight font-semibold uppercase"
                [class.muted]="side.teamId === null"
                >{{ side.label }}</span
              >
              @if (side.note) {
                <span class="text-[12px] muted">{{ side.note }}</span>
              }
              @if (side.score !== null) {
                <span class="font-heading text-[19px] font-semibold tnum">{{ side.score }}</span>
              }
            </div>
          }
        </div>
      </div>
    }

    <div class="grid grid-cols-[22px_1fr] gap-2">
      <div class="flex justify-center">
        <span class="size-[11px] border border-accent" aria-hidden="true"></span>
      </div>
      <p class="flex items-center gap-2 font-heading text-[17px] font-semibold uppercase">
        <app-icon name="crown" [size]="18" class="text-accent-700" />
        {{ championLabel() ?? 'CAMPEÃO' }}
      </p>
    </div>
  `,
  host: { class: 'block' },
})
export class LadderComponent {
  readonly steps = input.required<readonly LadderStep[]>();
  readonly championLabel = input<string | null>(null);

  protected stateLabel(step: LadderStep): string {
    return STATE_LABELS[step.state];
  }

  protected stateClass(step: LadderStep): string {
    if (step.state === 'now') {
      return 'bg-accent-700 text-bg';
    }
    if (step.state === 'done') {
      return 'tag-accent';
    }
    return 'tag-neutral';
  }
}
