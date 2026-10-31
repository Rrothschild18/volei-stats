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

/**
 * Cadastro e edição de jogador (1y).
 *
 * A data de nascimento é obrigatória porque é ela, com o nome, que devolve o
 * acesso a quem trocou de celular (docs/PLANO-SUPABASE.md). O switch de
 * administrador mexe no papel **deste grupo**, e trava no último admin.
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

      <div class="field">
        <label for="player-birth">Data de nascimento · recupera o acesso</label>
        <input id="player-birth" class="input" type="date" [formField]="playerForm.birthDate" />
        @if (playerForm.birthDate().touched() && playerForm.birthDate().errors().length > 0) {
          <app-inline-note class="mt-2" tone="error">
            A data de nascimento é o que devolve o acesso junto com o nome.
          </app-inline-note>
        }
      </div>

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

      <div class="flex items-start gap-3 border-t border-divider pt-4">
        <span class="flex-1">
          <span class="block font-heading text-[17px] font-semibold uppercase">Administrador</span>
          <span class="block text-[13px] muted">
            Marca presença, sorteia, decide par-ou-ímpar e corrige placares
          </span>
        </span>
        <app-switch label="Administrador do grupo" [(checked)]="admin" [disabled]="lastAdmin()" />
      </div>

      @if (lastAdmin()) {
        <app-inline-note tone="event" icon="lock">
          É o último administrador do grupo. Promova outra pessoa antes de tirar o papel — sem
          admin, ninguém marca presença nem sorteia.
        </app-inline-note>
      }

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

  protected readonly model = signal({ name: '', birthDate: '' });
  protected readonly playerForm = form(this.model, (path) => {
    required(path.name);
    required(path.birthDate);
  });

  protected readonly gender = signal<string>(Gender.MALE);
  protected readonly active = signal(true);
  protected readonly admin = signal(false);
  protected readonly stats = signal<PlayerStats | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly adminCount = signal(0);

  protected readonly genders = [
    { id: Gender.MALE, label: 'Masculino' },
    { id: Gender.FEMALE, label: 'Feminino' },
  ];

  protected readonly isNew = computed(() => !this.playerId());

  /** Só trava quando a pessoa editada é o único admin que o grupo tem. */
  protected readonly lastAdmin = computed(() => this.admin() && this.adminCount() <= 1);

  async ngOnInit(): Promise<void> {
    const groupId = this.group.groupId();
    const playerId = this.playerId();
    if (!groupId) {
      return;
    }

    const members = await this.facade.getGroupMembers(groupId);
    this.adminCount.set(members.filter((member) => member.role === 'admin').length);

    if (!playerId) {
      return;
    }

    const [player, stats] = await Promise.all([
      this.facade.getPlayerById(playerId),
      this.statistics.getPlayerStats(playerId, await this.facade.getGroupScope(groupId)),
    ]);

    if (player) {
      this.model.set({ name: player.name, birthDate: player.birthDate ?? '' });
      this.gender.set(player.gender);
      this.active.set(player.active);
      this.admin.set(members.find((member) => member.playerId === playerId)?.role === 'admin');
    }

    this.stats.set(stats);
  }

  protected async save(): Promise<void> {
    const groupId = this.group.groupId();
    if (!groupId || this.playerForm().invalid()) {
      return;
    }

    const { name, birthDate } = this.model();
    const gender = this.gender() as Gender;
    this.error.set(null);

    try {
      const playerId = this.playerId();
      if (playerId) {
        const player = await this.facade.getPlayerById(playerId);
        if (player) {
          await this.facade.updatePlayer({
            ...player,
            name,
            birthDate,
            gender,
            active: this.active(),
          });
        }
        await this.facade.setGroupRole(groupId, playerId, this.admin() ? 'admin' : 'player');
      } else {
        const created = await this.facade.createPlayer(name, gender, birthDate);
        await this.facade.addGroupMember(groupId, created.id, this.admin() ? 'admin' : 'player');
      }

      await this.group.enter(groupId);
      this.cancel();
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : 'Não foi possível salvar.');
    }
  }

  protected cancel(): void {
    void this.router.navigate(['/g', this.group.groupId(), 'jogadores']);
  }
}
