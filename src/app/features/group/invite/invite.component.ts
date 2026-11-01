import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MembershipService } from '../../../core/identity';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import {
  BlueprintComponent,
  BusyDirective,
  IconComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
  SkeletonComponent,
} from '../../../shared/ui';
import { describeError } from '../../../shared/utils/error.util';

/** As três escritas desta tela, cada uma com o seu botão. */
type InviteAction = 'codigo' | 'senha' | 'convite';

/**
 * O convite do vôlei: o código e o link que vão para o grupo do zap.
 *
 * Um convite, reutilizável de propósito — serve para o grupo todo, e a mesma
 * pessoa usa no celular e no tablet. Cancelar gera outro código: é assim que se
 * tranca quem não deveria ter entrado, porque o id do vôlei nunca muda e
 * trancar por ele não trancaria nada.
 *
 * O código vai acompanhado da data inicial do grupo, que a tela **não mostra**:
 * ela é senha, e o banco não a entrega a cliente nenhum. Quem a sabe é quem
 * criou o vôlei.
 */
@Component({
  selector: 'app-invite',
  imports: [
    BlueprintComponent,
    BusyDirective,
    IconComponent,
    InlineNoteComponent,
    InnerHeaderComponent,
    SkeletonComponent,
  ],
  template: `
    <app-inner-header context="VÔLEI" title="CONVITE" (back)="back()" />

    <div class="flex flex-col gap-5 px-4 pb-8">
      @if (loading()) {
        <app-skeleton [rows]="3" label="Carregando o convite…" />
      } @else if (code() === null) {
        <app-blueprint class="p-4">
          <p class="text-[14px]">Este vôlei não tem convite aberto.</p>
        </app-blueprint>
        <button
          type="button"
          class="btn btn-primary h-13"
          [appBusy]="busy() === 'convite'"
          [disabled]="busy() !== null"
          (click)="renew()"
        >
          GERAR CONVITE
        </button>
      } @else {
        <app-blueprint class="p-4">
          <p class="kicker">CÓDIGO DO VÔLEI</p>
          <p class="mt-1 font-heading text-[34px] leading-none font-semibold tracking-[0.12em]">
            {{ code() }}
          </p>
          <p class="mt-3 text-[13px] muted">
            Mande o código <strong class="font-semibold">e a senha do grupo</strong> para a pessoa.
            Ela toca no nome dela, digita a senha e escolhe a data dela.
          </p>
        </app-blueprint>

        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="btn btn-secondary min-h-12" (click)="copyLink()">
            COPIAR LINK
          </button>
          <button type="button" class="btn btn-secondary min-h-12" (click)="share()">
            <app-icon name="send" [size]="18" />
            NO ZAP
          </button>
        </div>

        <div aria-live="polite">
          @if (notice()) {
            <app-inline-note tone="event">{{ notice() }}</app-inline-note>
          }
          @if (error()) {
            <app-inline-note tone="error">{{ error() }}</app-inline-note>
          }
        </div>

        <div class="border-t border-divider pt-5">
          <p class="kicker">ESCOLHER O CÓDIGO</p>
          <div class="field mt-3">
            <label for="invite-code">Código novo</label>
            <input
              id="invite-code"
              class="input font-heading tracking-[0.12em] uppercase"
              type="text"
              autocapitalize="characters"
              autocomplete="off"
              spellcheck="false"
              aria-describedby="invite-code-help"
              [value]="draft()"
              (input)="draft.set($any($event.target).value)"
            />
            <p id="invite-code-help" class="mt-2 text-[12px] muted">
              Letras, números e hífen. Tem de ser único entre todos os vôleis.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-secondary mt-3 min-h-12 w-full"
            [appBusy]="busy() === 'codigo'"
            [disabled]="!canRename() || busy() !== null"
            (click)="rename()"
          >
            TROCAR O CÓDIGO
          </button>
        </div>

        <div class="border-t border-divider pt-5">
          <p class="kicker">TROCAR A SENHA DO GRUPO</p>
          <p class="mt-1 text-[13px] muted">
            É o caminho de "entrou gente que não devia". Quem já disse quem é continua dentro — a
            senha só abre nome que ainda não tem dono.
          </p>
          <div class="field mt-3">
            <label for="invite-password">Senha nova</label>
            <input
              id="invite-password"
              class="input"
              type="text"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              [value]="senha()"
              (input)="senha.set($any($event.target).value)"
            />
          </div>
          <button
            type="button"
            class="btn btn-secondary mt-3 min-h-12 w-full"
            [appBusy]="busy() === 'senha'"
            [disabled]="senha().trim().length < 4 || busy() !== null"
            (click)="trocarSenha()"
          >
            SALVAR A SENHA
          </button>
        </div>

        <div class="border-t border-divider pt-5">
          <p class="kicker">CANCELAR ESTE CONVITE</p>
          <p class="mt-1 text-[13px] muted">
            O código atual para de funcionar e um novo é gerado. Quem já entrou continua dentro.
          </p>
          <button
            type="button"
            class="btn btn-secondary mt-3 min-h-12 w-full"
            [appBusy]="busy() === 'convite'"
            [disabled]="busy() !== null"
            (click)="renew()"
          >
            CANCELAR E GERAR OUTRO
          </button>
        </div>

        <div class="border-t border-divider pt-5">
          <p class="kicker">O PESSOAL</p>
          <p class="mt-1 text-[13px] muted">
            Cadastre cada pessoa com nome e sexo. A data você não escolhe: todos entram com a
            inicial do grupo e trocam pela deles.
          </p>
          <button type="button" class="btn btn-primary mt-3 min-h-12 w-full" (click)="players()">
            CADASTRAR JOGADORES
          </button>
        </div>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class InviteComponent implements OnInit {
  private readonly membership = inject(MembershipService);
  private readonly group = inject(CurrentGroupStore);
  private readonly router = inject(Router);

  protected readonly code = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly senha = signal('');
  protected readonly loading = signal(true);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  /**
   * Qual ação está esperando o banco.
   *
   * Não é um booleano porque a tela tem três botões que escrevem: um booleano
   * faria os três girarem juntos, e o anel tem de ficar no botão que a pessoa
   * tocou.
   */
  protected readonly busy = signal<InviteAction | null>(null);

  protected readonly canRename = computed(() => this.draft().trim().length >= 3);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId) {
      return;
    }
    this.loading.set(true);
    try {
      const invite = await this.membership.invite(groupId);
      this.code.set(invite?.code ?? null);
    } catch (cause) {
      this.error.set(describeError(cause, 'Não foi possível ler o convite.'));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * O link que vai no zap.
   *
   * Sai de `document.baseURI`, e não de `location`: o app roteia por caminho
   * (não há `withHashLocation`), e publicado no Pages ele vive sob um prefixo.
   * A versão anterior montava `…/convite#/entrar/CODE` — um fragmento que o
   * roteador ignora, então quem recebia caía na tela do dono e era mandado para
   * `/entrar` sem código nenhum preenchido.
   */
  private link(): string {
    return new URL(`entrar/${this.code()}`, document.baseURI).href;
  }

  protected async copyLink(): Promise<void> {
    this.error.set(null);
    try {
      await navigator.clipboard.writeText(this.link());
      this.notice.set('Link copiado.');
    } catch {
      // Área de transferência bloqueada: mostra o link para copiar à mão.
      this.notice.set(this.link());
    }
  }

  protected async share(): Promise<void> {
    const text = `Entra no vôlei: código ${this.code()} — ${this.link()}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Cancelou o compartilhamento: nada a fazer.
        return;
      }
    }
    await this.copyLink();
  }

  protected async rename(): Promise<void> {
    if (!this.canRename()) {
      return;
    }

    await this.run(
      'codigo',
      async (groupId) => {
        const invite = await this.membership.setInviteCode(
          groupId,
          this.draft().trim().toUpperCase(),
        );
        this.code.set(invite.code);
        this.draft.set('');
        this.notice.set('Código trocado.');
      },
      'Não foi possível trocar o código.',
    );
  }

  protected async trocarSenha(): Promise<void> {
    if (this.senha().trim().length < 4) {
      return;
    }

    await this.run(
      'senha',
      async (groupId) => {
        await this.membership.setJoinPassword(groupId, this.senha().trim());
        this.senha.set('');
        this.notice.set('Senha trocada. Mande a nova para quem ainda vai entrar.');
      },
      'Não foi possível trocar a senha.',
    );
  }

  protected async renew(): Promise<void> {
    await this.run(
      'convite',
      async (groupId) => {
        const invite = await this.membership.renewInvite(groupId);
        this.code.set(invite.code);
        this.notice.set('Convite novo gerado. O código antigo não entra mais.');
      },
      'Não foi possível gerar o convite.',
    );
  }

  /** O que as três escritas da tela têm em comum: a espera, o aviso e o erro. */
  private async run(
    which: InviteAction,
    action: (groupId: string) => Promise<void>,
    fallback: string,
  ): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId || this.busy() !== null) {
      return;
    }

    this.error.set(null);
    this.notice.set(null);
    this.busy.set(which);
    try {
      await action(groupId);
    } catch (cause) {
      this.error.set(describeError(cause, fallback));
    } finally {
      this.busy.set(null);
    }
  }

  protected players(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'jogadores']);
  }

  protected back(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'inicio']);
  }
}
