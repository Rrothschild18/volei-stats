import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { AppFacade } from '../../../core/facade/app.facade';
import { Player, PlayerStats } from '../../../shared/models';

@Component({
  selector: 'app-player-detail',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatCardModule],
  template: `
    <div class="p-4 max-w-lg mx-auto">
      @if (player()) {
        <div class="flex justify-between items-center mb-4">
          <h1 class="text-2xl font-bold">{{ player()!.name }}</h1>
          <a mat-icon-button [routerLink]="['editar']" aria-label="Editar jogador">
            <mat-icon>edit</mat-icon>
          </a>
        </div>

        <mat-card class="mb-4">
          <mat-card-content class="p-4">
            <dl class="grid grid-cols-2 gap-2">
              <dt class="font-medium text-gray-600">Sexo</dt>
              <dd>{{ player()!.gender === 'M' ? 'Masculino' : 'Feminino' }}</dd>
              <dt class="font-medium text-gray-600">Status</dt>
              <dd [class]="player()!.active ? 'text-green-600' : 'text-red-600'">
                {{ player()!.active ? 'Ativo' : 'Inativo' }}
              </dd>
            </dl>
          </mat-card-content>
        </mat-card>

        @if (stats()) {
          <mat-card>
            <mat-card-header>
              <mat-card-title>Estatísticas</mat-card-title>
            </mat-card-header>
            <mat-card-content class="p-4">
              <dl class="grid grid-cols-2 gap-2">
                <dt class="font-medium text-gray-600">Jogos disputados</dt>
                <dd>{{ stats()!.gamesPlayed }}</dd>
                <dt class="font-medium text-gray-600">Vitórias</dt>
                <dd>{{ stats()!.wins }}</dd>
                <dt class="font-medium text-gray-600">Derrotas</dt>
                <dd>{{ stats()!.losses }}</dd>
                <dt class="font-medium text-gray-600">Aproveitamento</dt>
                <dd>{{ stats()!.winPercentage }}%</dd>
                <dt class="font-medium text-gray-600">Vezes em espera</dt>
                <dd>{{ stats()!.timesWaited }}</dd>
              </dl>
            </mat-card-content>
          </mat-card>
        }
      }

      <div class="mt-4">
        <a mat-button routerLink="/jogadores">
          <mat-icon>arrow_back</mat-icon>
          Voltar
        </a>
      </div>
    </div>
  `,
})
export class PlayerDetailComponent implements OnInit {
  private facade = inject(AppFacade);
  private route = inject(ActivatedRoute);

  player = signal<Player | null>(null);
  stats = signal<PlayerStats | null>(null);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const player = await this.facade.getPlayerById(id);
      if (player) {
        this.player.set(player);
        const stats = await this.facade.getPlayerStats(id);
        this.stats.set(stats);
      }
    }
  }
}
