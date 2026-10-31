import { Component, computed, input } from '@angular/core';
import { IconComponent } from './icon/icon.component';

/**
 * Quem está usando o app, no topo de cada tela.
 *
 * Mostra o nome, porque é isso que importa: o que a pessoa pode fazer não
 * depende mais de um papel, e sim de ela já ter dito quem é. O selo de dono
 * aparece junto porque ele explica por que *aquela* pessoa vê o cadastro.
 */
@Component({
  selector: 'app-role-tag',
  imports: [IconComponent],
  template: `
    <span class="flex items-center gap-1.5">
      <span class="tag tag-neutral">
        <app-icon name="user-round" [size]="13" />
        {{ name() }}
      </span>
      @if (isOwner()) {
        <span class="tag tag-outline">DONO</span>
      }
    </span>
  `,
})
export class RoleTagComponent {
  readonly isOwner = input(false);
  readonly playerName = input<string | null>(null);

  protected readonly name = computed(() => this.playerName() ?? 'Visitante');
}
