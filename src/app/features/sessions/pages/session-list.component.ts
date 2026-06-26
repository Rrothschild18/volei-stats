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
      @if (sessions().length === 0) {
        <p class="text-center text-gray-500 mt-8">Nenhuma sessão registrada.</p>
      }

      <h4 class="text-lg font-semibold mb-2">Histórico de sessões</h4>
      <p class="text-gray-600 text-sm mb-2">
        Visualize e gerencie as sessões registradas. Clique em uma sessão para ver detalhes, ou crie
        uma nova sessão.
      </p>

      <div class="flex flex-col gap-3">
        @for (session of sessions(); track session.id) {
          <mat-card class="border! bg-white! shadow-none! border-outline-variant!">
            <mat-card-content class="p-4">
              <div class="flex justify-between items-center">
                <div>
                  <p class="font-medium">{{ session.date | date: 'dd/MM/yyyy' }}</p>

                  <section class="flex  gap-6 mt-4">
                    <div class="flex gap-2 items-center ">
                      <mat-icon
                        fontSet="material-symbols-outlined"
                        class="text-tertiary! text-4xl  inline-flex! items-center! justify-center! rounded-xl! m-icon"
                        >group</mat-icon
                      >
                      <p>{{ session.playerIds.length }} jogadores</p>
                    </div>
                    <p>•</p>
                    <div class="flex gap-2 items-center ">
                      <mat-icon
                        fontSet="material-symbols-outlined"
                        class="text-secondary! text-4xl  inline-flex! items-center! justify-center! rounded-xl! m-icon"
                        >emoji_events</mat-icon
                      >

                      <p>{{ session.tournamentIds.length }} campeonatos</p>
                    </div>
                  </section>
                </div>

                <button
                  matIconButton
                  [routerLink]="[session.id]"
                  aria-label="Ver sessão"
                  aria-label="Example icon button with a vertical three dot icon"
                >
                  <mat-icon>chevron_right</mat-icon>
                </button>
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>

      <div class="flex flex-col gap-2 mt-4">
        <button
          matButton
          class="w-full! bg-primary-container! text-on-primary-container!
                    shadow-lg hover:shadow-xl hover:scale-105
                    transition-all duration-300 active:scale-95
                    rounded-lg!"
          extended
          routerLink="nova"
        >
          <mat-icon class="text-on-primary-container!">add</mat-icon>
          Criar sessão
        </button>
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
