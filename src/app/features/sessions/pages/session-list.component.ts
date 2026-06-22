import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { DatePipe } from '@angular/common';
import { AppFacade } from '../../../core/facade/app.facade';
import { Session } from '../../../shared/models';

@Component({
  selector: 'app-session-list',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatCardModule, MatListModule, DatePipe],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-bold">Sessões</h1>
        <a mat-fab extended routerLink="nova" aria-label="Nova sessão">
          <mat-icon>add</mat-icon>
          Nova Sessão
        </a>
      </div>

      @if (sessions().length === 0) {
        <p class="text-center text-gray-500 mt-8">Nenhuma sessão registrada.</p>
      }

      <div class="flex flex-col gap-3">
        @for (session of sessions(); track session.id) {
          <mat-card>
            <mat-card-content class="p-4">
              <div class="flex justify-between items-center">
                <div>
                  <p class="font-medium">{{ session.date | date: 'dd/MM/yyyy' }}</p>
                  <p class="text-sm text-gray-500">
                    {{ session.playerIds.length }} jogadores •
                    {{ session.tournamentIds.length }} campeonatos
                  </p>
                </div>
                <a mat-icon-button [routerLink]="[session.id]" aria-label="Ver sessão">
                  <mat-icon>chevron_right</mat-icon>
                </a>
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>
    </div>
  `,
})
export class SessionListComponent implements OnInit {
  private facade = inject(AppFacade);
  sessions = signal<Session[]>([]);

  async ngOnInit() {
    const sessions = await this.facade.getSessions();
    this.sessions.set(sessions.sort((a, b) => b.date.localeCompare(a.date)));
  }
}
