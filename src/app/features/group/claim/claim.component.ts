import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ClaimFailure, MembershipService, UnclaimedPlayer } from '../../../core/identity';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import {
  ActionBarComponent,
  BlueprintComponent,
  DateFieldComponent,
  GenderBadgeComponent,
  IconComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
} from '../../../shared/ui';
import { describeError } from '../../../shared/utils/error.util';

/** O que dizer para cada recusa. Nunca "esse nome não existe": ver abaixo. */
const MESSAGES: Record<ClaimFailure, string> = {
  // Nome que não existe, nome que já tem dono e senha errada dão a MESMA
  // mensagem de propósito: separá-las diria a quem tem o código quem está no
  // vôlei e quem já entrou.
  'not-found': 'Não deu certo. Confira o nome e a senha do grupo.',
  'birth-date-required': 'Informe a sua data de nascimento.',
  'too-many-tries':
    'Muitas tentativas. Espere uns quinze minutos, ou peça para quem é dono liberar.',
};

/**
 * "Quem você é?" — a tela que transforma visitante em jogador.
 *
 * Tocar no nome, digitar a senha que o grupo combinou e **a sua data de
 * nascimento**. A senha abre o nome uma vez; a data vira a sua chave, e é com
 * ela que você entra num aparelho novo depois.
 *
 * Quem já fez isso antes não aparece na lista — a lista é só de nomes que
 * ninguém reivindicou. Para essa pessoa existe o segundo caminho, com a data
 * dela.
 */
@Component({
  selector: 'app-claim',
  imports: [
    ActionBarComponent,
    BlueprintComponent,
    DateFieldComponent,
    GenderBadgeComponent,
    IconComponent,
    InlineNoteComponent,
    InnerHeaderComponent,
  ],
  template: `
    <app-inner-header context="ENTRAR" title="QUEM VOCÊ É?" (back)="back()" />

    @if (chosen() === null && !returning()) {
      <div class="flex flex-col gap-4 px-4 pb-8">
        <p class="text-[14px] muted">
          Toque no seu nome. Depois você digita a data que o grupo combinou e troca pela sua.
        </p>

        @if (loading()) {
          <p class="text-[13px] muted">Carregando os nomes…</p>
        } @else if (error()) {
          <app-blueprint class="p-4">
            <p class="text-[14px]" aria-live="polite">{{ error() }}</p>
          </app-blueprint>
        } @else if (names().length === 0) {
          <app-blueprint class="p-4">
            <p class="text-[14px]">
              Todos os nomes deste vôlei já têm dono. Se um deles é o seu, use o caminho de quem já
              entrou antes.
            </p>
          </app-blueprint>
        } @else {
          <ul class="flex flex-col gap-2">
            @for (player of names(); track player.id) {
              <li>
                <app-blueprint>
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 p-4 text-left"
                    (click)="choose(player)"
                  >
                    <app-gender-badge [gender]="player.gender" />
                    <span class="flex-1 font-heading text-[19px] font-semibold uppercase">{{
                      player.name
                    }}</span>
                    <app-icon name="chevron-right" [size]="20" />
                  </button>
                </app-blueprint>
              </li>
            }
          </ul>
        }

        <button
          type="button"
          class="btn btn-secondary min-h-12 normal-case"
          (click)="startReturning()"
        >
          Já entrei antes, em outro aparelho
        </button>
      </div>
    } @else {
      <div class="flex flex-col gap-5 px-4 pb-8">
        @if (returning()) {
          <div class="field">
            <label for="claim-name">Seu nome neste vôlei</label>
            <input
              id="claim-name"
              class="input"
              type="text"
              autocomplete="off"
              [value]="name()"
              (input)="name.set($any($event.target).value)"
            />
          </div>

          <app-date-field
            fieldId="claim-own-date"
            label="Sua data de nascimento"
            [(value)]="birthDate"
          />
        } @else {
          <app-blueprint class="p-4">
            <p class="kicker">VOCÊ É</p>
            <p class="font-heading text-[26px] leading-none font-semibold uppercase">
              {{ name() }}
            </p>
          </app-blueprint>

          <div class="field">
            <label for="claim-password">A senha do grupo</label>
            <input
              id="claim-password"
              class="input"
              type="text"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              aria-describedby="claim-password-help"
              [value]="password()"
              (input)="password.set($any($event.target).value)"
            />
            <p id="claim-password-help" class="mt-2 text-[12px] muted">
              Quem organiza mandou ela junto com o código.
            </p>
          </div>

          <div>
            <app-date-field
              fieldId="claim-new-date"
              label="Sua data de nascimento"
              describedBy="claim-new-date-help"
              [(value)]="newBirthDate"
            />
            <p id="claim-new-date-help" class="mt-2 text-[12px] muted">
              Ela vira a sua chave neste vôlei: é ela que você digita para entrar num aparelho novo.
              Ninguém vê, nem quem é dono.
            </p>
          </div>
        }

        <div aria-live="polite">
          @if (error()) {
            <app-inline-note tone="error">{{ error() }}</app-inline-note>
          }
        </div>
      </div>

      <app-action-bar [pair]="true">
        <button type="button" class="btn btn-secondary h-13" (click)="reset()">VOLTAR</button>
        <button
          type="button"
          class="btn btn-primary blueprint h-13 text-[17px]"
          [disabled]="!canSubmit()"
          (click)="submit()"
        >
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
          <i class="corner br"></i>
          {{ busy() ? 'ENTRANDO…' : 'SOU EU' }}
        </button>
      </app-action-bar>
    }
  `,
  host: { class: 'block' },
})
export class ClaimComponent implements OnInit {
  private readonly membership = inject(MembershipService);
  private readonly group = inject(CurrentGroupStore);
  private readonly router = inject(Router);

  protected readonly names = signal<readonly UnclaimedPlayer[]>([]);
  protected readonly loading = signal(true);
  protected readonly chosen = signal<UnclaimedPlayer | null>(null);
  /** O caminho de quem já reivindicou o nome num outro aparelho. */
  protected readonly returning = signal(false);

  protected readonly name = signal('');
  /** A senha do grupo, no caminho de quem está entrando pela primeira vez. */
  protected readonly password = signal('');
  /** A própria data, no caminho de quem já entrou num outro aparelho. */
  protected readonly birthDate = signal('');
  protected readonly newBirthDate = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly canSubmit = computed(() => {
    if (this.busy() || this.name().trim() === '') {
      return false;
    }
    return this.returning()
      ? this.birthDate() !== ''
      : this.password().trim() !== '' && this.newBirthDate() !== '';
  });

  async ngOnInit(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId) {
      return;
    }
    try {
      this.names.set(await this.membership.unclaimedPlayers(groupId));
    } catch (cause) {
      // Sem isto, uma falha de leitura caía no estado de lista vazia — que diz
      // "todos os nomes já têm dono" a quem acabou de entrar e nunca teve um.
      this.error.set(describeError(cause, 'Não foi possível ler os nomes.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected choose(player: UnclaimedPlayer): void {
    this.chosen.set(player);
    this.name.set(player.name);
    this.error.set(null);
  }

  protected startReturning(): void {
    this.returning.set(true);
    this.name.set('');
    this.password.set('');
    this.birthDate.set('');
    this.error.set(null);
  }

  protected reset(): void {
    this.chosen.set(null);
    this.returning.set(false);
    this.name.set('');
    this.password.set('');
    this.birthDate.set('');
    this.newBirthDate.set('');
    this.error.set(null);
  }

  protected async submit(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId || !this.canSubmit()) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    try {
      // Duas portas, e não uma com um campo a mais: quem volta num aparelho
      // novo usa a PRÓPRIA data, e a senha do grupo não serve para ele — ela
      // abre um nome uma vez só.
      const result = this.returning()
        ? await this.membership.claimAgain({
            groupId,
            name: this.name().trim(),
            birthDate: this.birthDate(),
          })
        : await this.membership.claim({
            groupId,
            name: this.name().trim(),
            password: this.password().trim(),
            birthDate: this.newBirthDate(),
          });

      if (!result.ok) {
        this.error.set(MESSAGES[result.failure]);
        return;
      }

      // O papel mudou: visitante virou jogador. Recarregar aqui não é zelo —
      // `sou-quem` e `inicio` são irmãs dentro de `/g/:groupId`, e o Angular
      // não roda de novo o guard do pai quando só a filha muda. Sem isto, a
      // tela seguinte ainda acha que você é visitante.
      this.group.clear();
      await this.group.enter(groupId);
      await this.router.navigate(['/g', groupId, 'inicio']);
    } catch (cause) {
      this.error.set(describeError(cause, 'Não foi possível entrar.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    void this.router.navigate(['/voleis']);
  }
}
