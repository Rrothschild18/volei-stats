import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { AppFacade } from '../../../core/facade/app.facade';
import { Player } from '../../../shared/models';

@Component({
  selector: 'app-session-create',
  imports: [MatCheckboxModule, MatButtonModule, MatIconModule, MatCardModule],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <h1 class="text-2xl font-bold mb-4">Nova Sessão - Seleção de Jogadores</h1>
      <p class="text-gray-600 mb-4">Selecione os jogadores presentes hoje (mínimo 4, máximo 14).</p>

      <div class="mb-4 flex items-center gap-2">
        <span class="text-sm font-medium"
              [class]="selectedCount() < 4 ? 'text-red-500' : selectedCount() > 14 ? 'text-red-500' : 'text-green-600'">
          {{ selectedCount() }} / 14 selecionados
        </span>
        @if (selectedCount() > 0 && selectedCount() < 4) {
          <span class="text-sm text-red-500">(mínimo 4 jogadores)</span>
        }
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-6">
        @for (player of players(); track player.id) {
          <mat-card class="cursor-pointer" [class]="isSelected(player.id) ? 'border-2 border-blue-500' : ''">
            <mat-card-content class="p-3">
              <mat-checkbox
                [checked]="isSelected(player.id)"
                [disabled]="!isSelected(player.id) && selectedCount() >= 14"
                (change)="togglePlayer(player.id)"
                [attr.aria-label]="'Selecionar ' + player.name">
                <span class="font-medium">{{ player.name }}</span>
                <span class="text-sm text-gray-500 ml-2">({{ player.gender === 'M' ? 'M' : 'F' }})</span>
              </mat-checkbox>
            </mat-card-content>
          </mat-card>
        }
      </div>

      @if (errorMessage()) {
        <p class="text-red-500 text-sm mb-4" role="alert">{{ errorMessage() }}</p>
      }

      <div class="flex gap-2">
        <button mat-raised-button
                (click)="createSession()"
                [disabled]="selectedCount() < 4">
          Criar Sessão
        </button>
        <button mat-button (click)="cancel()">Cancelar</button>
      </div>
    </div>
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
