import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { DatePipe } from '@angular/common';
import { AppFacade } from '../../../core/facade/app.facade';
import { Tournament } from '../../../shared/models';

@Component({
  selector: 'app-tournament-list',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatCardModule, DatePipe],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold mb-4">Campeonatos</h1>

      @if (tournaments().length === 0) {
        <p class="text-center text-gray-500 mt-8">Nenhum campeonato registrado.</p>
      }

      <div class="flex flex-col gap-3">
        @for (t of tournaments(); track t.id) {
          <mat-card>
            <mat-card-content class="p-4">
              <div class="flex justify-between items-center">
                <div>
                  <p class="font-medium">{{ t.teams.length }} duplas • {{ t.pointLimit }} pontos</p>
                  <p class="text-sm text-gray-500">{{ t.createdAt | date: 'dd/MM/yyyy HH:mm' }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    [class]="
                      t.status === 'completed'
                        ? 'text-green-600 text-sm font-medium'
                        : 'text-blue-600 text-sm font-medium'
                    "
                  >
                    {{ t.status === 'completed' ? 'Finalizado' : 'Em andamento' }}
                  </span>
                  <a mat-icon-button [routerLink]="[t.id]" aria-label="Ver campeonato">
                    <mat-icon>chevron_right</mat-icon>
                  </a>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>
    </div>
  `,
})
export class TournamentListComponent implements OnInit {
  readonly #appFacade = inject(AppFacade);
  tournaments = signal<Tournament[]>([]);

  async ngOnInit() {
    const all = await this.#appFacade.getTournaments();
    this.tournaments.set(all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }
}
