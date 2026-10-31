import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BirthDateFailure, MembershipService } from '../../../core/identity';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { describeError } from '../../../shared/utils/error.util';
import {
  BlueprintComponent,
  DateFieldComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
} from '../../../shared/ui';

const MOTIVOS: Record<BirthDateFailure, string> = {
  'wrong-current': 'A data atual não confere.',
  'too-many-tries': 'Muitas tentativas. Espere uns quinze minutos.',
};

/**
 * Seus dados neste vôlei: o nome e a data.
 *
 * As duas coisas são suas e de mais ninguém, e é por isso que existem aqui em
 * vez de na tela de quem cadastra:
 *
 *   o nome — quem cadastrou digitou doze nomes de cabeça e escreveu o grosso.
 *            Num vôlei com Raul, Raphael e Rafael, é aqui que eles viram Raul,
 *            Rapha e Rafa, e param de se confundir na lista e no sorteio.
 *   a data — é a sua senha. Ninguém a vê, nem o dono; trocá-la exige saber a
 *            atual, porque um celular emprestado já está dentro do app.
 */
@Component({
  selector: 'app-me',
  imports: [BlueprintComponent, DateFieldComponent, InlineNoteComponent, InnerHeaderComponent],
  template: `
    <app-inner-header context="VÔLEI" title="SEUS DADOS" (back)="back()" />

    <div class="flex flex-col gap-5 px-4 pb-8">
      <section>
        <p class="kicker">SEU NOME NESTE VÔLEI</p>
        <p class="mt-1 text-[13px] muted">
          É como você aparece na presença, no sorteio e nos rankings. Vale só neste vôlei.
        </p>

        <div class="field mt-3">
          <label for="me-name">Nome</label>
          <input
            id="me-name"
            class="input"
            type="text"
            autocomplete="off"
            [value]="nome()"
            (input)="nome.set($any($event.target).value)"
          />
        </div>

        <button
          type="button"
          class="btn btn-primary mt-3 min-h-12 w-full"
          [disabled]="!podeTrocarNome()"
          (click)="trocarNome()"
        >
          SALVAR O NOME
        </button>

        <div class="mt-3" aria-live="polite">
          @if (avisoNome()) {
            <app-inline-note tone="event">{{ avisoNome() }}</app-inline-note>
          }
          @if (erroNome()) {
            <app-inline-note tone="error">{{ erroNome() }}</app-inline-note>
          }
        </div>
      </section>

      @if (temSenha()) {
        <section class="border-t border-divider pt-5">
          <p class="kicker">SUA DATA DE NASCIMENTO</p>
          <p class="mt-1 text-[13px] muted">
            É a sua senha neste vôlei: é ela que você digita para entrar num aparelho novo. Ninguém
            a vê, nem quem é dono.
          </p>

          <app-date-field
            class="mt-3"
            fieldId="me-current"
            label="A data de agora"
            [(value)]="atual"
          />

          <app-date-field class="mt-3" fieldId="me-next" label="A data nova" [(value)]="nova" />

          <button
            type="button"
            class="btn btn-primary mt-3 min-h-12 w-full"
            [disabled]="!podeTrocarData()"
            (click)="trocarData()"
          >
            SALVAR A DATA
          </button>

          <div class="mt-3" aria-live="polite">
            @if (avisoData()) {
              <app-inline-note tone="event">{{ avisoData() }}</app-inline-note>
            }
            @if (erroData()) {
              <app-inline-note tone="error">{{ erroData() }}</app-inline-note>
            }
          </div>
        </section>
      } @else {
        <app-blueprint class="p-4">
          <p class="text-[14px] muted">
            A data só existe contra o servidor — neste modo não há senha para trocar.
          </p>
        </app-blueprint>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class MeComponent implements OnInit {
  private readonly membership = inject(MembershipService);
  private readonly group = inject(CurrentGroupStore);
  private readonly router = inject(Router);

  protected readonly nome = signal('');
  protected readonly atual = signal('');
  protected readonly nova = signal('');
  protected readonly avisoNome = signal<string | null>(null);
  protected readonly erroNome = signal<string | null>(null);
  protected readonly avisoData = signal<string | null>(null);
  protected readonly erroData = signal<string | null>(null);
  private readonly salvando = signal(false);

  /** Sem servidor não há senha: a seção da data não aparece. */
  protected readonly temSenha = computed(() => this.membership.available);

  protected readonly podeTrocarNome = computed(() => {
    const nome = this.nome().trim();
    return !this.salvando() && nome.length > 0 && nome !== this.group.me()?.name;
  });

  protected readonly podeTrocarData = computed(
    () =>
      !this.salvando() && this.atual() !== '' && this.nova() !== '' && this.atual() !== this.nova(),
  );

  ngOnInit(): void {
    this.nome.set(this.group.me()?.name ?? '');
  }

  protected async trocarNome(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId || !this.podeTrocarNome()) {
      return;
    }

    this.salvando.set(true);
    this.avisoNome.set(null);
    this.erroNome.set(null);
    try {
      await this.membership.renameMe(groupId, this.nome().trim());
      // O nome carregado é o de antes: quem o mostra no cabeçalho e nas duplas
      // é este estado.
      this.group.clear();
      await this.group.enter(groupId);
      this.avisoNome.set('Nome trocado.');
    } catch (cause) {
      this.erroNome.set(describeError(cause, 'Não foi possível trocar o nome.'));
    } finally {
      this.salvando.set(false);
    }
  }

  protected async trocarData(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId || !this.podeTrocarData()) {
      return;
    }

    this.salvando.set(true);
    this.avisoData.set(null);
    this.erroData.set(null);
    try {
      const resultado = await this.membership.changeMyBirthDate({
        groupId,
        current: this.atual(),
        next: this.nova(),
      });

      if (!resultado.ok) {
        this.erroData.set(MOTIVOS[resultado.failure]);
        return;
      }

      this.atual.set('');
      this.nova.set('');
      this.avisoData.set('Data trocada. É esta que você usa num aparelho novo.');
    } catch (cause) {
      this.erroData.set(describeError(cause, 'Não foi possível trocar a data.'));
    } finally {
      this.salvando.set(false);
    }
  }

  protected back(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'inicio']);
  }
}
