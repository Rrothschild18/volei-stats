import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MembershipService } from '../../core/identity';
import { Gender } from '../../shared/enums';
import {
  ActionBarComponent,
  DateFieldComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
  SegmentedComponent,
} from '../../shared/ui';
import { describeError } from '../../shared/utils/error.util';

/**
 * Criar um vôlei: o nome dele, quem você é, e a senha que o grupo vai combinar.
 *
 * Dois segredos, e eles fazem coisas diferentes:
 *
 *   a sua data   — é a sua chave, daqui em diante. Você já entra com ela, então
 *                  seu nome nunca aparece na lista de nomes por reivindicar.
 *   a senha do   — é o que vai no zap junto com o código, e abre cada nome uma
 *   grupo          vez. Depois que a pessoa entrou, a senha não abre mais o
 *                  nome dela.
 */
@Component({
  selector: 'app-create-group',
  imports: [
    ActionBarComponent,
    DateFieldComponent,
    InlineNoteComponent,
    InnerHeaderComponent,
    SegmentedComponent,
  ],
  template: `
    <app-inner-header context="ENTRAR" title="CRIAR UM VÔLEI" (back)="back()" />

    <div class="flex flex-col gap-5 px-4 pb-8">
      <div class="field">
        <label for="group-name">Nome do vôlei</label>
        <input
          id="group-name"
          class="input"
          type="text"
          autocomplete="off"
          placeholder="Vôlei de Segunda"
          [value]="groupName()"
          (input)="groupName.set($any($event.target).value)"
        />
      </div>

      <div class="border-t border-divider pt-5">
        <p class="kicker">VOCÊ</p>

        <div class="field mt-3">
          <label for="owner-name">Seu nome</label>
          <input
            id="owner-name"
            class="input"
            type="text"
            autocomplete="given-name"
            [value]="ownerName()"
            (input)="ownerName.set($any($event.target).value)"
          />
        </div>

        <div class="mt-4">
          <p class="mb-[5px] text-[12px] muted">Sexo</p>
          <app-segmented
            [options]="genders"
            [value]="gender()"
            (valueChange)="gender.set($any($event))"
            [tabs]="false"
          />
          <p class="mt-2 text-[12px] muted">Usado só no sorteio, para preferir duplas mistas.</p>
        </div>

        <app-date-field
          class="mt-4"
          fieldId="owner-date"
          label="Sua data de nascimento"
          describedBy="owner-date-help"
          [(value)]="ownerBirthDate"
        />
        <p id="owner-date-help" class="mt-2 text-[12px] muted">
          É a sua chave. Ninguém vê, nem você depois.
        </p>
      </div>

      <div class="border-t border-divider pt-5">
        <p class="kicker">O GRUPO</p>

        <div class="field mt-3">
          <label for="join-password">Senha do grupo</label>
          <input
            id="join-password"
            class="input"
            type="text"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            placeholder="volei99"
            aria-describedby="join-password-help"
            [value]="joinPassword()"
            (input)="joinPassword.set($any($event.target).value)"
          />
          <p id="join-password-help" class="mt-2 text-[12px] muted">
            Escolha algo simples de ditar — ela vai no zap junto com o código. Cada pessoa usa ela
            uma vez, para dizer qual nome é o dela.
          </p>
        </div>
      </div>

      <div aria-live="polite">
        @if (error()) {
          <app-inline-note tone="error">{{ error() }}</app-inline-note>
        }
      </div>
    </div>

    <app-action-bar [pair]="true">
      <button type="button" class="btn btn-secondary h-13" (click)="back()">CANCELAR</button>
      <button
        type="button"
        class="btn btn-primary blueprint h-13 text-[17px]"
        [disabled]="!canSubmit()"
        (click)="submit()"
      >
        <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i>
        <i class="corner br"></i>
        {{ busy() ? 'CRIANDO…' : 'CRIAR' }}
      </button>
    </app-action-bar>
  `,
  host: { class: 'block' },
})
export class CreateGroupComponent {
  private readonly membership = inject(MembershipService);
  private readonly router = inject(Router);

  protected readonly genders = [
    { id: Gender.MALE, label: 'Masculino' },
    { id: Gender.FEMALE, label: 'Feminino' },
  ];

  protected readonly groupName = signal('');
  protected readonly ownerName = signal('');
  protected readonly gender = signal<Gender>(Gender.MALE);
  protected readonly ownerBirthDate = signal('');
  protected readonly joinPassword = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly canSubmit = computed(
    () =>
      !this.busy() &&
      this.groupName().trim().length > 0 &&
      this.ownerName().trim().length > 0 &&
      this.ownerBirthDate() !== '' &&
      this.joinPassword().trim().length >= 4,
  );

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    try {
      const created = await this.membership.createGroup({
        groupName: this.groupName().trim(),
        ownerName: this.ownerName().trim(),
        ownerGender: this.gender(),
        ownerBirthDate: this.ownerBirthDate(),
        joinPassword: this.joinPassword().trim(),
      });
      // Direto para o convite: a primeira coisa que o dono faz é cadastrar o
      // pessoal e mandar o código.
      await this.router.navigate(['/g', created.groupId, 'convite']);
    } catch (cause) {
      this.error.set(describeError(cause, 'Não foi possível criar o vôlei.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    void this.router.navigate(['/entrar']);
  }
}
