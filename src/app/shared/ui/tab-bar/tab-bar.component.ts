import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon-data';

interface Tab {
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
}

const TABS: readonly Tab[] = [
  { path: 'inicio', label: 'Início', icon: 'house' },
  { path: 'campeonatos', label: 'Campeonatos', icon: 'trophy' },
  { path: 'rankings', label: 'Rankings', icon: 'list-ordered' },
  { path: 'jogadores', label: 'Jogadores', icon: 'users' },
];

/** As quatro abas do grupo. Sempre dentro de um vôlei. */
@Component({
  selector: 'app-tab-bar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    @for (tab of tabs; track tab.path; let first = $first) {
      <a
        class="flex flex-col items-center gap-[5px] px-0 pt-[11px] pb-[7px] font-heading text-[12px] leading-none font-semibold tracking-[0.08em] uppercase no-underline"
        [class.border-l]="!first"
        [class.border-divider]="!first"
        [routerLink]="['/g', groupId(), tab.path]"
        routerLinkActive="bg-accent-100 text-accent-800 shadow-[inset_0_2px_0_var(--color-accent)]"
        #link="routerLinkActive"
        [attr.aria-current]="link.isActive ? 'page' : null"
      >
        <app-icon [name]="tab.icon" [size]="22" />
        {{ tab.label }}
      </a>
    }
  `,
  host: {
    class:
      'grid grid-cols-4 border-t border-divider bg-bg text-neutral-700 pb-4 sticky bottom-0 z-10',
  },
})
export class TabBarComponent {
  readonly groupId = input.required<string>();
  protected readonly tabs = TABS;
}
