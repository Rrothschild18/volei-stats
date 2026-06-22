import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AppFacade } from '../../../core/facade/app.facade';
import { Gender } from '../../../shared/enums';

@Component({
  selector: 'app-player-form',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatSlideToggleModule,
  ],
  template: `
    <div class="p-4 max-w-lg mx-auto">
      <h1 class="text-2xl font-bold mb-4">{{ isEdit() ? 'Editar Jogador' : 'Novo Jogador' }}</h1>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
        <mat-form-field appearance="outline">
          <mat-label>Nome</mat-label>
          <input matInput formControlName="name" placeholder="Nome do jogador" />
          @if (form.controls.name.hasError('required') && form.controls.name.touched) {
            <mat-error>Nome é obrigatório</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Sexo</mat-label>
          <mat-select formControlName="gender">
            <mat-option [value]="Gender.MALE">Masculino</mat-option>
            <mat-option [value]="Gender.FEMALE">Feminino</mat-option>
          </mat-select>
          @if (form.controls.gender.hasError('required') && form.controls.gender.touched) {
            <mat-error>Sexo é obrigatório</mat-error>
          }
        </mat-form-field>

        @if (isEdit()) {
          <mat-slide-toggle formControlName="active">
            {{ form.value.active ? 'Ativo' : 'Inativo' }}
          </mat-slide-toggle>
        }

        <div class="flex gap-2 mt-4">
          <button mat-raised-button type="submit" [disabled]="form.invalid">
            {{ isEdit() ? 'Salvar' : 'Cadastrar' }}
          </button>
          <button mat-button type="button" (click)="onCancel()">Cancelar</button>
        </div>
      </form>
    </div>
  `,
})
export class PlayerFormComponent implements OnInit {
  private facade = inject(AppFacade);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  protected readonly Gender = Gender;
  isEdit = signal(false);
  private playerId: string | null = null;

  form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    gender: ['' as Gender | '', Validators.required],
    active: [true],
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.playerId = id;
      const player = await this.facade.getPlayerById(id);
      if (player) {
        this.form.patchValue({
          name: player.name,
          gender: player.gender,
          active: player.active,
        });
      }
    }
  }

  async onSubmit() {
    if (this.form.invalid) return;

    const { name, gender, active } = this.form.getRawValue();

    if (this.isEdit() && this.playerId) {
      const player = await this.facade.getPlayerById(this.playerId);
      if (player) {
        player.name = name;
        player.gender = gender as Gender;
        player.active = active;
        await this.facade.updatePlayer(player);
      }
    } else {
      await this.facade.createPlayer(name, gender as Gender);
    }

    this.router.navigate(['/jogadores']);
  }

  onCancel() {
    this.router.navigate(['/jogadores']);
  }
}
