import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { AppFacade } from '../../../core/facade/app.facade';
import { Player } from '../../../shared/models';
import { JsonPipe } from '@angular/common';

@Component({
  selector: 'app-session-create',
  imports: [MatCheckboxModule, MatButtonModule, MatIconModule, MatCardModule, JsonPipe],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <h2 class="text-2xl font-bold mb-1">Seleção de Jogadores</h2>
      <p class="text-gray-600 text-sm mb-2">
        Selecione os jogadores presentes hoje (mínimo 4, máximo 14).
      </p>

      <!-- Selection Status Counter -->
      <div
        class="bg-white rounded-m3-md p-4 mb-6 shadow-sm border border-gray-300 flex items-center justify-between transition-all rounded-lg"
      >
        <div>
          <span
            class="text-xl font-bold transition-colors"
            [class]="
              selectedCount() < 4
                ? 'text-red-500'
                : selectedCount() > 14
                  ? 'text-red-500'
                  : 'text-green-500'
            "
          >
            {{ selectedCount() }} / 14 selecionados</span
          >
        </div>
        @if (selectedCount() >= 4) {
          <mat-icon class="text-green-500!">check_small_outline</mat-icon>
        } @else {
          <mat-icon class="text-red-500!">error_outline</mat-icon>
        }
      </div>

      <!-- END: Player List -->

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-6">
        @for (player of players(); track player.id) {
          <mat-card
            class="cursor-pointer bg-beach-card! border-0! shadow-none!"
            [class]="isSelected(player.id) ? 'outline-2! outline-primary/50! bg-primary/10!' : ''"
          >
            <mat-card-content class="p-3 flex! justify-between! items-center! gap-2 w-full!">
              <mat-checkbox
                [checked]="isSelected(player.id)"
                [disabled]="!isSelected(player.id) && selectedCount() >= 14"
                (change)="togglePlayer(player.id)"
                [attr.aria-label]="'Selecionar ' + player.name"
              >
                <div class="flex items-center justify-between w-full">
                  <span class="font-medium">{{ player.name }}</span>
                </div>
              </mat-checkbox>

              @if (player.gender === 'F') {
                <span class="px-3 py-1 bg-pink-100 text-pink-700 text-xs font-bold rounded-full"
                  >F</span
                >
              }

              @if (player.gender === 'M') {
                <span class="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full"
                  >M</span
                >
              }
            </mat-card-content>
          </mat-card>
        }
      </div>

      @if (errorMessage()) {
        <p class="text-red-500 text-sm mb-4" role="alert">{{ errorMessage() }}</p>
      }

      <div class="flex gap-2">
        <button mat-raised-button (click)="createSession()" [disabled]="selectedCount() < 4">
          Criar Sessão
        </button>
        <button mat-button (click)="cancel()">Cancelar</button>
      </div>

      <button
        matFab
        class="w-11/12! bg-secondary-container! text-on-secondary-container!
         fixed! bottom-26 left-1/2 -translate-x-1/2
         shadow-lg hover:shadow-xl hover:scale-105
         transition-all duration-300 active:scale-95
         z-40 group"
        extended
        [disabled]="selectedCount() < 4"
        (click)="createSession()"
      >
        <mat-icon>shuffle</mat-icon>
        Sortear equipes
      </button>
    </div>
  `,
  styles: `
    /* Custom styles for the component */
    ::ng-deep {
      .mdc-label {
        width: 100% !important;
      }

      .mdc-form-field.mat-internal-form-field {
        background: red !important;
      }
    }
  `,
})
export class SessionCreateComponent implements OnInit {
  private facade = inject(AppFacade);
  private router = inject(Router);

  players = signal<Player[]>([]);
  selectedIds = signal<Set<string>>(new Set());
  errorMessage = signal('');

  selectedCount = computed(() => this.selectedIds().size);

  async ngOnInit() {
    const active = await this.facade.getActivePlayers();
    this.players.set(active);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  togglePlayer(id: string) {
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      if (current.size >= 14) return;
      current.add(id);
    }
    this.selectedIds.set(current);
    this.errorMessage.set('');
  }

  async createSession() {
    if (this.selectedCount() < 4) {
      this.errorMessage.set('Selecione pelo menos 4 jogadores para criar uma sessão.');
      return;
    }

    const session = await this.facade.createSession([...this.selectedIds()]);
    this.router.navigate(['/sessoes', session.id]);
  }

  cancel() {
    this.router.navigate(['/sessoes']);
  }
}
