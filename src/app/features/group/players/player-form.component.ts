import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, required } from '@angular/forms/signals';
import { AppFacade } from '../../../core/facade/app.facade';
import { CurrentGroupStore } from '../../../core/stores/current-group.store';
import { StatisticsService } from '../../../core/services/statistics.service';
import { Gender } from '../../../shared/enums';
import { PlayerStats } from '../../../shared/models';
import {
  ActionBarComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
  SegmentedComponent,
  StatGridComponent,
  SwitchComponent,
} from '../../../shared/ui';
import { describeError } from '../../../shared/utils/error.util';

/**
 * Cadastro e edição de jogador (1y). É do dono do vôlei.
 *
 * A data de nascimento **não aparece aqui**: ela é a senha da pessoa
 * (docs/PLANO-SUPABASE.md §1). Quem cadastra não escolhe a data de ninguém —
 * todos nascem com a data inicial do vôlei e trocam pela própria ao entrar — e
 * quem edita não vê a de ninguém.
 */
@Component({
  selector: 'app-player-form',
  imports: [
    ActionBarComponent,
    FormField,
    InlineNoteComponent,
    InnerHeaderComponent,
    SegmentedComponent,
    StatGridComponent,
    SwitchComponent,
  ],
  template: `
    <app-inner-header
      context="JOGADORES"
      [title]="isNew() ? 'NOVO JOGADOR' : 'EDITAR JOGADOR'"
      (back)="cancel()"
    />

    <div class="flex flex-col gap-5 px-4 pb-8">
      <div class="field">
        <label for="player-name">Nome</label>
        <input id="player-name" class="input" type="text" [formField]="playerForm.name" />
        @if (playerForm.name().touched() && playerForm.name().errors().length > 0) {
          <app-inline-note class="mt-2" tone="error">Escreva o nome do jogador.</app-inline-note>
        }
      </div>

      @if (isNew()) {
        <app-inline-note tone="event" icon="lock">
          A pessoa entra pelo link do vôlei com a
          <strong class="font-semibold">data inicial do grupo</strong> e troca pela data dela — que
          passa a ser a senha dela. Você não escolhe, e não vê.
        </app-inline-note>
      }

      <div>
        <p class="mb-[5px] text-[12px] muted">Sexo</p>
        <app-segmented
          [options]="genders"
          [value]="gender()"
          (valueChange)="gender.set($any($event))"
          [tabs]="false"
        />
        <p class="mt-2 text-[12px] muted">Usado só no sorteio, para preferir duplas mistas.</p>
      </div>

      <div class="flex items-start gap-3 border-t border-divider pt-4">
        <span class="flex-1">
          <span class="block font-heading text-[17px] font-semibold uppercase">Ativo</span>
          <span class="block text-[13px] muted">Aparece na lista de presença</span>
        </span>
        <app-switch label="Jogador ativo" [(checked)]="active" />
      </div>

      @if (stats(); as entry) {
        <app-stat-grid
          [items]="[
            { value: entry.gamesPlayed, label: 'jogos' },
            { value: entry.winPercentage + '%', label: 'vitórias' },
            { value: entry.timesWaited, label: 'esperas' },
          ]"
        />
      }

      @if (error()) {
        <app-inline-note tone="error">{{ error() }}</app-inline-note>
      }
    </div>

    <app-action-bar [pair]="true">
      <button type="button" class="btn btn-secondary h-13" (click)="cancel()">CANCELAR</button>
      <button
        type="button"
        class="btn btn-primary blueprint h-13 text-[17px]"
        [disabled]="playerForm().invalid()"
        (click)="save()"
      >
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
        <i class="corner br"></i>
        SALVAR
      </button>
    </app-action-bar>
  `,
  host: { class: 'block' },
})
export class PlayerFormComponent implements OnInit {
  private readonly facade = inject(AppFacade);
  private readonly statistics = inject(StatisticsService);
  private readonly router = inject(Router);
  private readonly group = inject(CurrentGroupStore);

  readonly playerId = input<string | undefined>(undefined);

  protected readonly model = signal({ name: '' });
  protected readonly playerForm = form(this.model, (path) => {
    required(path.name);
  });

  protected readonly gender = signal<string>(Gender.MALE);
  protected readonly active = signal(true);
  protected readonly stats = signal<PlayerStats | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly genders = [
    { id: Gender.MALE, label: 'Masculino' },
    { id: Gender.FEMALE, label: 'Feminino' },
  ];

  protected readonly isNew = computed(() => !this.playerId());

  async ngOnInit(): Promise<void> {
    const groupId = this.group.groupId();
    const playerId = this.playerId();
    if (!groupId) {
      return;
    }

    if (!playerId) {
      return;
    }

    const [player, stats] = await Promise.all([
      this.facade.getPlayerById(playerId),
      this.statistics.getPlayerStats(playerId, await this.facade.getGroupScope(groupId)),
    ]);

    if (player) {
      this.model.set({ name: player.name });
      this.gender.set(player.gender);
      this.active.set(player.active);
    }

    this.stats.set(stats);
  }

  protected async save(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId || this.playerForm().invalid()) {
      return;
    }

    const { name } = this.model();
    const gender = this.gender() as Gender;
    this.error.set(null);

    try {
      const playerId = this.playerId();
      if (playerId) {
        const player = await this.facade.getPlayerById(playerId);
        if (player) {
          // A data não vem do formulário: ela é senha, e só a própria pessoa a
          // troca (ou o dono a reseta para a inicial do vôlei).
          await this.facade.updatePlayer({ ...player, name, gender, active: this.active() });
        }
      } else {
        // Cadastrar não cria associação: o jogador nasce como um nome por
        // reivindicar, e quem o reivindica é a própria pessoa, com a data.
        await this.facade.createPlayer(groupId, name, gender);
      }

      await this.group.enter(groupId);
      this.cancel();
    } catch (cause) {
      this.error.set(describeError(cause, 'Não foi possível salvar.'));
    }
  }

  protected cancel(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'jogadores']);
  }
}
