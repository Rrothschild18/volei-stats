import { Component, computed, input } from '@angular/core';
import { GroupRole } from '../models';
import { IconComponent } from './icon/icon.component';

/** O papel de quem está usando o app aparece no topo de cada tela. */
@Component({
  selector: 'app-role-tag',
  imports: [IconComponent],
  template: `
    @if (role() === 'admin') {
      <span class="tag tag-outline">ADMIN</span>
    } @else {
      <span class="tag tag-neutral">
        <app-icon name="user-round" [size]="13" />
        {{ name() }}
      </span>
    }
  `,
})
export class RoleTagComponent {
  readonly role = input.required<GroupRole | null>();
  readonly playerName = input<string | null>(null);

  protected readonly name = computed(() => this.playerName() ?? 'Jogador');
}
