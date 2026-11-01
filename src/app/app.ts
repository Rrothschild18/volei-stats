import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { SkeletonComponent } from './shared/ui';

/** Abaixo disso, dizer "abrindo" seria um piscar de cinza e nada mais. */
const ATRASO_MS = 150;

/**
 * A casca do app, e o único lugar de onde dá para falar sobre a PRIMEIRA tela —
 * a que ainda não existe.
 *
 * A rota de entrada é guardada por `hasGroupsGuard`, que vai ao banco para
 * saber de que vôleis a pessoa participa. Enquanto ele responde o Angular não
 * monta componente nenhum: não existe tela onde pendurar um esqueleto, e o que
 * a pessoa vê é uma página em branco. Com o banco nos Estados Unidos isso são
 * alguns segundos, toda vez que o app abre.
 *
 * **Só a primeira**, e isso é o ponto. Da segunda navegação em diante já existe
 * tela montada, e o Angular a mantém no lugar enquanto o guard da próxima
 * responde. Trocar isso por um esqueleto desmontaria o que está funcionando —
 * inclusive a barra de abas, que vive acima do outlet das abas. Quem avisa daí
 * para frente é a própria tela de destino, com o esqueleto dela, e a barra de
 * abas, que marca a aba que está abrindo.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SkeletonComponent],
  template: `
    @if (navegando()) {
      <div class="px-4 pt-6">
        <app-skeleton [rows]="2" label="Abrindo…" />
        <div class="mt-6">
          <app-skeleton [rows]="4" />
        </div>
      </div>
    } @else {
      <router-outlet />
    }
  `,
})
export class App {
  protected readonly navegando = signal(false);

  /** Vira falso na primeira tela que chega a ser montada, e nunca mais volta. */
  #primeira = true;

  constructor() {
    const router = inject(Router);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const assinatura = router.events.subscribe((evento) => {
      if (evento instanceof NavigationStart) {
        if (!this.#primeira) {
          return;
        }
        clearTimeout(timer);
        timer = setTimeout(() => this.navegando.set(true), ATRASO_MS);
        return;
      }

      // Cancelada conta: um guard que redireciona termina a navegação em
      // `NavigationCancel` e começa outra. O esqueleto segue até uma delas
      // chegar ao fim — é tudo "o app abrindo", visto de fora.
      if (evento instanceof NavigationEnd) {
        clearTimeout(timer);
        this.#primeira = false;
        this.navegando.set(false);
        return;
      }

      if (evento instanceof NavigationError) {
        clearTimeout(timer);
        this.navegando.set(false);
      }
    });

    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      assinatura.unsubscribe();
    });
  }
}
