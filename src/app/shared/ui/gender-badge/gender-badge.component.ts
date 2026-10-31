import { Component, computed, input } from '@angular/core';
import { Gender } from '../../enums';

/** Selo de sexo do jogador. Usado só no sorteio, para preferir duplas mistas. */
@Component({
  selector: 'app-gender-badge',
  template: `{{ gender() }}`,
  host: {
    class:
      'inline-flex items-center justify-center size-5 border text-[10px] font-semibold leading-none',
    '[class]': 'palette()',
    '[attr.aria-label]': 'label()',
    role: 'img',
  },
})
export class GenderBadgeComponent {
  readonly gender = input.required<Gender>();

  protected readonly palette = computed(() =>
    this.gender() === Gender.FEMALE
      ? 'bg-female-100 text-female-800 border-female-300'
      : 'bg-accent-100 text-accent-800 border-accent-300',
  );

  protected readonly label = computed(() =>
    this.gender() === Gender.FEMALE ? 'Feminino' : 'Masculino',
  );
}
