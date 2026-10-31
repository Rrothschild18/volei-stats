import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CurrentGroupStore } from '../../core/stores/current-group.store';
import { TabBarComponent } from '../../shared/ui';

/**
 * Casca das telas de um grupo: o conteúdo da aba e a barra inferior. A troca de
 * vôlei acontece no header de cada tela raiz, que volta para "Seus vôleis".
 */
@Component({
  selector: 'app-group-shell',
  imports: [RouterOutlet, TabBarComponent],
  template: `
    <main class="flex-1 pb-2">
      <router-outlet />
    </main>
    @if (groupId()) {
      <app-tab-bar [groupId]="groupId()!" />
    }
  `,
  host: { class: 'flex min-h-dvh flex-col' },
})
export class GroupShellComponent {
  private readonly router = inject(Router);
  protected readonly store = inject(CurrentGroupStore);
  protected readonly groupId = this.store.groupId;

  protected switchGroup(): void {
    void this.router.navigate(['/voleis']);
  }
}
