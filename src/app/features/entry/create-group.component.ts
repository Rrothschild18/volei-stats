import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MembershipService } from '../../core/identity';
import { Gender } from '../../shared/enums';
import {
  ActionBarComponent,
  InlineNoteComponent,
  InnerHeaderComponent,
  SegmentedComponent,
} from '../../shared/ui';

/** A data que o grupo combina, sugerida para ninguém precisar inventar uma. */
const SUGGESTED_INITIAL_DATE = '2000-01-01';

/**
 * Criar um vôlei: o nome dele, quem você é, e a data que o grupo vai combinar.
 *
 * Duas datas, e elas fazem coisas diferentes:
 *
 *   a sua       — é a sua senha, daqui em diante. Você já entra com ela, então
 *                 seu nome nunca aparece na lista de nomes por reivindicar.
 *   a do grupo  — é a senha de primeiro acesso de todo mundo que você cadastrar,
 *                 e é ela que vai junto com o código no grupo do zap.
 *
 * Elas **não podem ser iguais**: se forem, o seu nome fica reivindicável com a
 * senha que você mesmo manda — e quem abrir o link assume o vôlei. Quem recusa
 * é o banco; aqui a tela só explica antes.
 */
@Component({
  selector: 'app-create-group',
  imports: [ActionBarComponent, InlineNoteComponent, InnerHeaderComponent, SegmentedComponent],
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

        <div class="field mt-4">
          <label for="owner-date">Sua data de nascimento</label>
          <input
            id="owner-date"
            class="input"
            type="date"
            autocomplete="bday"
            aria-describedby="owner-date-help"
            [value]="ownerBirthDate()"
            (input)="ownerBirthDate.set($any($event.target).value)"
          />
          <p id="owner-date-help" class="mt-2 text-[12px] muted">
            É a sua senha. Ninguém vê, nem você depois.
          </p>
        </div>
      </div>

      <div class="border-t border-divider pt-5">
        <p class="kicker">O GRUPO</p>

        <div class="field mt-3">
          <label for="initial-date">Data inicial do grupo</label>
          <input
            id="initial-date"
            class="input"
            type="date"
            aria-describedby="initial-date-help"
            [value]="initialBirthDate()"
            (input)="initialBirthDate.set($any($event.target).value)"
          />
          <p id="initial-date-help" class="mt-2 text-[12px] muted">
            É esta data que você manda junto com o código. Cada pessoa usa ela para entrar e troca
            pela data dela na hora.
          </p>
        </div>
      </div>

      <div aria-live="polite">
        @if (sameDates()) {
          <app-inline-note tone="error">
            A sua data tem de ser diferente da data inicial do grupo — senão o seu nome fica
            destrancado pela senha que você vai mandar no zap.
          </app-inline-note>
        } @else if (error()) {
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
  protected readonly initialBirthDate = signal(SUGGESTED_INITIAL_DATE);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly sameDates = computed(
    () => this.ownerBirthDate() !== '' && this.ownerBirthDate() === this.initialBirthDate(),
  );

  protected readonly canSubmit = computed(
    () =>
      !this.busy() &&
      !this.sameDates() &&
      this.groupName().trim().length > 0 &&
      this.ownerName().trim().length > 0 &&
      this.ownerBirthDate() !== '' &&
      this.initialBirthDate() !== '',
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
        initialBirthDate: this.initialBirthDate(),
      });
      // Direto para o convite: a primeira coisa que o dono faz é cadastrar o
      // pessoal e mandar o código.
      await this.router.navigate(['/g', created.groupId, 'convite']);
    } catch (cause) {
      this.error.set(cause instanceof Error ? cause.message : 'Não foi possível criar o vôlei.');
    } finally {
      this.busy.set(false);
    }
  }

  protected back(): void {
    void this.router.navigate(['/entrar']);
  }
}
