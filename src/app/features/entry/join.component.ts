import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MembershipService } from '../../core/identity';
import { BlueprintComponent, IconComponent, InlineNoteComponent } from '../../shared/ui';
import { describeError } from '../../shared/utils/error.util';

/**
 * A porta do app: o código de um vôlei, ou criar o seu.
 *
 * É a única tela que existe antes de a pessoa participar de alguma coisa. O
 * código entra digitado ou pelo link (`/entrar/TESTE-VOLEI`), e vale dos dois
 * jeitos — é o mesmo convite.
 *
 * O código põe a pessoa DENTRO do vôlei, e nada mais: ela lê, e ainda não é
 * ninguém. Quem ela é, ela diz na tela seguinte, com nome e data.
 */
@Component({
  selector: 'app-join',
  imports: [BlueprintComponent, IconComponent, InlineNoteComponent],
  template: `
    <header class="px-4 pt-10 pb-6">
      <p class="kicker">VÔLEI STATS</p>
      <h1 class="title-xl mt-2">ENTRAR NUM VÔLEI</h1>
      <p class="mt-2 text-[14px] muted">
        Quem organiza o seu vôlei tem um código. Digite ele aqui — ou crie o seu.
      </p>
    </header>

    <form class="flex flex-col gap-4 px-4" (submit)="submit($event)">
      <div class="field">
        <label for="join-code">Código do vôlei</label>
        <input
          id="join-code"
          class="input text-center font-heading text-[24px] tracking-[0.18em] uppercase"
          type="text"
          name="code"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          inputmode="text"
          placeholder="XXXXXX"
          [value]="code()"
          (input)="code.set($any($event.target).value)"
          [attr.aria-describedby]="error() ? 'join-error' : null"
          [attr.aria-invalid]="error() ? 'true' : null"
        />
      </div>

      <div aria-live="polite">
        @if (error()) {
          <app-inline-note id="join-error" tone="error">{{ error() }}</app-inline-note>
        }
      </div>

      <button
        type="submit"
        class="btn btn-primary blueprint h-13 text-[17px]"
        [disabled]="busy() || code().trim().length === 0"
      >
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
        <i class="corner br"></i>
        {{ busy() ? 'ENTRANDO…' : 'ENTRAR' }}
      </button>
    </form>

    <div class="px-4 pt-8">
      <app-blueprint>
        <button
          type="button"
          class="flex w-full items-center gap-3 p-4 text-left"
          (click)="create()"
        >
          <span class="flex-1">
            <span class="block font-heading text-[20px] font-semibold uppercase"
              >Criar um vôlei</span
            >
            <span class="block text-[13px] muted">
              Você cadastra o pessoal e manda o código para eles.
            </span>
          </span>
          <app-icon name="chevron-right" [size]="20" />
        </button>
      </app-blueprint>
    </div>
  `,
  host: { class: 'block min-h-dvh' },
})
export class JoinComponent implements OnInit {
  private readonly membership = inject(MembershipService);
  private readonly router = inject(Router);

  /** Vem do link do convite: `/entrar/TESTE-VOLEI`. */
  readonly inviteCode = input<string | undefined>(undefined);

  protected readonly code = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  ngOnInit(): void {
    const fromLink = this.inviteCode();
    if (fromLink) {
      this.code.set(fromLink.toUpperCase());
    }
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    try {
      const { groupId } = await this.membership.redeemCode(this.code());
      // Entrou, e ainda não é ninguém: a próxima tela é dizer quem.
      await this.router.navigate(['/g', groupId, 'sou-quem']);
    } catch (cause) {
      this.error.set(describeError(cause, 'Não foi possível entrar.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected create(): void {
    void this.router.navigate(['/criar']);
  }
}
