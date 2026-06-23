import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { AppFacade } from '../../../core/facade/app.facade';
import { TournamentService } from '../../../core/services/tournament.service';
import { DrawProposal, Player, TournamentTeam } from '../../../shared/models';
import { TournamentTeamsComponent } from '../../../shared/components/tournament-teams.component';

@Component({
  selector: 'app-tournament-create',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatCardModule,
    TournamentTeamsComponent,
  ],
  template: `
    <div class="p-4 max-w-lg mx-auto">
      <h1 class="text-2xl font-bold mb-4">Criar Campeonato</h1>

      @if (draw()) {
        <mat-card class="mb-4">
          <mat-card-content class="p-4">
            <p class="font-semibold mb-2">
              {{ draw()!.teams.length }} duplas{{ draw()!.waitingPlayerId ? ' + 1' : '' }}
            </p>
            <app-tournament-teams
              [teams]="draw()!.teams"
              [players]="playerMap()"
              [waitingPlayer]="waitingPlayer()"
            />
          </mat-card-content>
        </mat-card>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
          <mat-form-field appearance="outline">
            <mat-label>Limite de pontos</mat-label>
            <input matInput type="number" formControlName="pointLimit" min="1" />
            @if (form.controls.pointLimit.hasError('required')) {
              <mat-error>Limite de pontos é obrigatório</mat-error>
            }
            @if (form.controls.pointLimit.hasError('min')) {
              <mat-error>Deve ser pelo menos 1</mat-error>
            }
          </mat-form-field>

          @if (draw()!.teams.length >= 4) {
            <mat-slide-toggle formControlName="thirdPlaceEnabled">
              Disputa de 3º/4º lugar
            </mat-slide-toggle>
          }

          @if (draw()!.waitingPlayerId) {
            <mat-slide-toggle formControlName="oddPlayerPlacementEnabled">
              Encaixe do jogador avulso
            </mat-slide-toggle>
            <p class="text-sm text-gray-600 -mt-2">
              Quando ativado, o avulso pode entrar no campeonato pelo encaixe oficial.
            </p>

            <mat-slide-toggle formControlName="coinFlipLossPriorityEnabled">
              Prioridade para quem perdeu o par ou ímpar
            </mat-slide-toggle>
            <p class="text-sm text-gray-600 -mt-2">
              Quando ativado, o jogador que perdeu o sorteio ganha prioridade no próximo campeonato.
            </p>
          }

          <div class="flex gap-2">
            <button mat-raised-button type="submit" [disabled]="form.invalid">
              Iniciar Campeonato
            </button>
            <button mat-button type="button" (click)="cancel()">Cancelar</button>
          </div>
        </form>
      }
    </div>
  `,
})
export class TournamentCreateComponent implements OnInit {
  private facade = inject(AppFacade);
  private tournamentService = inject(TournamentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  draw = signal<DrawProposal | null>(null);
  playerMap = signal<Map<string, Player>>(new Map());
  waitingPlayer = signal<Player | null>(null);
  private sessionId = '';

  form = this.fb.nonNullable.group({
    pointLimit: [15, [Validators.required, Validators.min(1)]],
    thirdPlaceEnabled: [true],
    oddPlayerPlacementEnabled: [true],
    coinFlipLossPriorityEnabled: [true],
  });

  async ngOnInit() {
    const drawId = this.route.snapshot.queryParamMap.get('drawId') || '';
    this.sessionId = this.route.snapshot.queryParamMap.get('sessionId') || '';

    if (!drawId || !this.sessionId) {
      this.router.navigate(['/sessoes']);
      return;
    }

    const draw = await this.facade.getDrawById(drawId);
    if (draw) {
      this.draw.set(draw);

      // Load players for display
      const map = new Map<string, Player>();
      for (const team of draw.teams) {
        for (const pid of team.playerIds) {
          if (!map.has(pid)) {
            const p = await this.facade.getPlayerById(pid);
            if (p) map.set(pid, p);
          }
        }
      }

      if (draw.waitingPlayerId) {
        const wp = await this.facade.getPlayerById(draw.waitingPlayerId);
        if (wp) {
          map.set(wp.id, wp);
          this.waitingPlayer.set(wp);
        }
      }

      this.playerMap.set(map);

      if (!draw.waitingPlayerId) {
        this.form.controls.oddPlayerPlacementEnabled.setValue(false);
        this.form.controls.oddPlayerPlacementEnabled.disable();
        this.form.controls.coinFlipLossPriorityEnabled.setValue(false);
        this.form.controls.coinFlipLossPriorityEnabled.disable();
      }

      if (draw.waitingPlayerId && draw.teams.length === 4) {
        this.form.controls.thirdPlaceEnabled.setValue(false);
      }
    }
  }

  async onSubmit() {
    if (this.form.invalid || !this.draw()) return;

    const { pointLimit, thirdPlaceEnabled, oddPlayerPlacementEnabled, coinFlipLossPriorityEnabled } =
      this.form.getRawValue();
    const drawData = this.draw()!;

    const teams: TournamentTeam[] = drawData.teams.map((t) => ({
      id: t.id,
      playerIds: t.playerIds,
      eliminated: false,
      eliminatedDirectly: false,
      synthetic: false,
      originalPlayerIds: null,
    }));

    const tournament = await this.tournamentService.createTournament(
      this.sessionId,
      drawData.id,
      teams,
      pointLimit,
      drawData.waitingPlayerId && oddPlayerPlacementEnabled && drawData.teams.length === 4
        ? false
        : thirdPlaceEnabled,
      drawData.waitingPlayerId,
      oddPlayerPlacementEnabled,
      coinFlipLossPriorityEnabled,
    );

    // Update session
    const session = await this.facade.getSessionById(this.sessionId);
    if (session) {
      session.tournamentIds.push(tournament.id);
      await this.facade.updateSession(session);
    }

    this.router.navigate(['/campeonatos', tournament.id]);
  }

  cancel() {
    this.router.navigate(['/sessoes', this.sessionId]);
  }
}

