import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { AppFacade } from '../../../core/facade/app.facade';
import { Player } from '../../../shared/models';

@Component({
  selector: 'app-player-list',
  imports: [
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-2xl font-bold">Jogadores</h1>
        <a mat-fab extended routerLink="novo" aria-label="Adicionar jogador">
          <mat-icon>add</mat-icon>
          Novo Jogador
        </a>
      </div>

      <div class="mb-4">
        <mat-form-field appearance="outline" class="w-48">
          <mat-label>Filtrar por status</mat-label>
          <mat-select [value]="filter()" (selectionChange)="onFilterChange($event.value)">
            <mat-option value="all">Todos</mat-option>
            <mat-option value="active">Ativos</mat-option>
            <mat-option value="inactive">Inativos</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <table mat-table [dataSource]="filteredPlayers()" class="w-full" aria-label="Lista de jogadores">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Nome</th>
          <td mat-cell *matCellDef="let player">{{ player.name }}</td>
        </ng-container>

        <ng-container matColumnDef="gender">
          <th mat-header-cell *matHeaderCellDef>Sexo</th>
          <td mat-cell *matCellDef="let player">{{ player.gender === 'M' ? 'Masculino' : 'Feminino' }}</td>
        </ng-container>

        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let player">
            <span [class]="player.active ? 'text-green-600 font-medium' : 'text-red-600 font-medium'">
              {{ player.active ? 'Ativo' : 'Inativo' }}
            </span>
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>Ações</th>
          <td mat-cell *matCellDef="let player">
            <a mat-icon-button [routerLink]="[player.id]" aria-label="Visualizar jogador">
              <mat-icon>visibility</mat-icon>
            </a>
            <a mat-icon-button [routerLink]="[player.id, 'editar']" aria-label="Editar jogador">
              <mat-icon>edit</mat-icon>
            </a>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>

      @if (filteredPlayers().length === 0) {
        <p class="text-center text-gray-500 mt-8">Nenhum jogador encontrado.</p>
      }
    </div>
  `,
})
export class PlayerListComponent implements OnInit {
  private facade = inject(AppFacade);
  private router = inject(Router);

  players = signal<Player[]>([]);
  filter = signal<string>('all');
  displayedColumns = ['name', 'gender', 'status', 'actions'];

  filteredPlayers = signal<Player[]>([]);

  async ngOnInit() {
    await this.loadPlayers();
  }

  async loadPlayers() {
    const all = await this.facade.getPlayers();
    this.players.set(all);
    this.applyFilter();
  }

  onFilterChange(value: string) {
    this.filter.set(value);
    this.applyFilter();
  }

  private applyFilter() {
    const all = this.players();
    switch (this.filter()) {
      case 'active':
        this.filteredPlayers.set(all.filter(p => p.active));
        break;
      case 'inactive':
        this.filteredPlayers.set(all.filter(p => !p.active));
        break;
      default:
        this.filteredPlayers.set(all);
    }
  }
}
