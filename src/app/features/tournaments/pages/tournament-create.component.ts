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
import { TeamsDisplayComponent } from '../../../shared/components/display-team/display-team.component';

@Component({
  selector: 'app-tournament-create',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatCardModule,
    TeamsDisplayComponent,
  ],
  template: `
    <div class="p-4 max-w-lg mx-auto">
      <h1 class="text-2xl font-bold mb-4">Criar Campeonato</h1>

      @if (draw()) {
        <p class="font-medium mb-2">
          {{ draw()!.teams.length }} duplas{{ draw()!.waitingPlayerId ? ' + 1' : '' }}
        </p>
        <app-teams-display
          class="block mb-4"
          [teams]="draw()!.teams"
          [players]="players()"
          [waitingPlayerId]="draw()!.waitingPlayerId"
        />

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
              Encaixe do jogador em espera
            </mat-slide-toggle>
            <p class="text-sm text-gray-600 -mt-2">
              O jogador entrará no campeonato para jogar com a dupla que perdeu por menos.
            </p>

            @if (form.controls.oddPlayerPlacementEnabled.value) {
              <mat-slide-toggle formControlName="oddPlayerLoserPriorityEnabled">
                Prioridade para quem perdeu o par-ou-ímpar
              </mat-slide-toggle>
              <p class="text-sm text-gray-600 -mt-2">
                Quando ativado, o jogador que perdeu o par-ou-ímpar do encaixe terá prioridade no
                primeiro jogo próximo sorteio.
              </p>
            }
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
  players = signal<Player[]>([]);
  private sessionId = '';

  form = this.fb.nonNullable.group({
    pointLimit: [15, [Validators.required, Validators.min(1)]],
    thirdPlaceEnabled: [true],
    oddPlayerPlacementEnabled: [true],
    oddPlayerLoserPriorityEnabled: [true],
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

      const ids = new Set<string>();
      for (const team of draw.teams) {
        team.playerIds.forEach((id) => ids.add(id));
      }
      if (draw.waitingPlayerId) {
        ids.add(draw.waitingPlayerId);
      }
      const players: Player[] = [];
      for (const id of ids) {
        const p = await this.facade.getPlayerById(id);
        if (p) players.push(p);
      }
      this.players.set(players);

      if (!draw.waitingPlayerId) {
        this.form.controls.oddPlayerPlacementEnabled.setValue(false);
        this.form.controls.oddPlayerPlacementEnabled.disable();
      }

      if (draw.waitingPlayerId && draw.teams.length === 4) {
        this.form.controls.thirdPlaceEnabled.setValue(false);
      }
    }
  }

  async onSubmit() {
    if (this.form.invalid || !this.draw()) return;

    const {
      pointLimit,
      thirdPlaceEnabled,
      oddPlayerPlacementEnabled,
      oddPlayerLoserPriorityEnabled,
    } = this.form.getRawValue();
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
      oddPlayerLoserPriorityEnabled,
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
