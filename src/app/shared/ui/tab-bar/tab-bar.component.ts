import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
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

/** Abaixo disso, marcar a aba seria um piscar e nada mais. */
const ATRASO_MS = 150;

/**
 * As quatro abas do grupo. Sempre dentro de um vôlei.
 *
 * A aba tocada fica marcada enquanto a próxima tela não chega — e, medido, ela
 * quase sempre chega antes de a marca aparecer: a troca de aba não passa pelo
 * `memberGuard` (o Angular não reativa a rota pai ao andar entre as filhas
 * dela), então são 35 ms e nenhum pedido ao banco.
 *
 * O caso que sobra é a PRIMEIRA visita a cada aba, quando o pedaço de código
 * dela ainda vai ser baixado. Numa rede de celular ruim isso demora, e é o
 * único momento em que tocar numa aba não faz nada visível. Daí os 150 ms de
 * atraso: eles existem para que o caso comum — instantâneo — não pisque.
 *
 * A marca mora aqui, e não num esqueleto de tela, porque durante a troca a
 * tela antiga segue montada: quem tem de falar é o que a pessoa tocou.
 */
@Component({
  selector: 'app-tab-bar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  template: `
    @for (tab of tabs; track tab.path; let first = $first) {
      <a
        class="flex flex-col items-center gap-[5px] px-0 pt-[11px] pb-[7px] font-heading text-[12px] leading-none font-semibold tracking-[0.08em] uppercase no-underline"
        [class.border-l]="!first"
        [class.border-divider]="!first"
        [class.tab-abrindo]="abrindo() === tab.path"
        [routerLink]="['/g', groupId(), tab.path]"
        routerLinkActive="bg-accent-100 text-accent-800 shadow-[inset_0_2px_0_var(--color-accent)]"
        #link="routerLinkActive"
        [attr.aria-current]="link.isActive ? 'page' : null"
        [attr.aria-busy]="abrindo() === tab.path ? 'true' : null"
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

  /** A aba cuja tela está sendo aberta, ou nulo. */
  protected readonly abrindo = signal<string | null>(null);

  constructor() {
    const router = inject(Router);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const assinatura = router.events.subscribe((evento) => {
      if (evento instanceof NavigationStart) {
        const alvo = TABS.find((tab) => evento.url.endsWith(`/${tab.path}`));
        clearTimeout(timer);
        if (alvo) {
          timer = setTimeout(() => this.abrindo.set(alvo.path), ATRASO_MS);
        }
        return;
      }

      if (
        evento instanceof NavigationEnd ||
        evento instanceof NavigationCancel ||
        evento instanceof NavigationError
      ) {
        clearTimeout(timer);
        this.abrindo.set(null);
      }
    });

    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      assinatura.unsubscribe();
    });
  }
}
