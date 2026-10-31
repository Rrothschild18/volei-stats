import { Component, computed, input, model } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { IconComponent } from '../icon/icon.component';

/** `1988-07-23` → `Date` local. Nulo quando não há data. */
function paraData(iso: string): Date | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) {
    return null;
  }
  // Componentes locais, nunca `new Date(iso)`: a string ISO é meia-noite em
  // UTC, e a oeste de Greenwich isso cai no dia anterior.
  return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
}

/** `Date` → `1988-07-23`, que é o que o banco guarda. */
export function paraIso(data: Date | null): string {
  if (!data) {
    return '';
  }
  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

/**
 * Campo de data de nascimento: digitar ou escolher no calendário.
 *
 * O calendário abre direto na lista de ANOS. Data de nascimento está trinta
 * anos atrás, e um calendário que abre no mês corrente obrigaria a pessoa a
 * voltar mês a mês — por isso quem sabe a data digita, e quem não lembra o dia
 * navega a partir do ano.
 *
 * Por fora, o valor é sempre `aaaa-mm-dd`: é o que o banco guarda, e a
 * conversão fica aqui dentro para não espalhar o problema de fuso.
 *
 * Escuta `dateInput` **e** `dateChange`: o primeiro dispara a cada tecla, o
 * segundo só ao sair do campo. Só com o segundo, quem digitasse a data e fosse
 * direto ao botão o encontraria ainda desabilitado.
 */
@Component({
  selector: 'app-date-field',
  imports: [MatDatepickerModule, IconComponent],
  template: `
    <div class="field">
      <label [attr.for]="fieldId()">{{ label() }}</label>

      <div class="flex items-stretch gap-2">
        <input
          class="input flex-1"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="dd/mm/aaaa"
          [id]="fieldId()"
          [matDatepicker]="calendario"
          [max]="hoje"
          [value]="comoData()"
          [attr.aria-describedby]="describedBy() || null"
          (dateInput)="value.set(toIso($event.value))"
          (dateChange)="value.set(toIso($event.value))"
        />

        <button
          type="button"
          class="btn btn-secondary btn-icon shrink-0"
          [attr.aria-label]="'Escolher ' + label() + ' no calendário'"
          (click)="calendario.open()"
        >
          <app-icon name="calendar" [size]="20" />
        </button>
      </div>

      <mat-datepicker #calendario startView="multi-year" [startAt]="comecaEm()" />
    </div>
  `,
  host: { class: 'block' },
})
export class DateFieldComponent {
  readonly label = input.required<string>();
  readonly fieldId = input.required<string>();
  /** `aaaa-mm-dd`, vazio quando não há data. */
  readonly value = model<string>('');
  /** Id do texto de ajuda logo abaixo do campo, quando houver. */
  readonly describedBy = input('');

  /** Data de nascimento não é no futuro. */
  protected readonly hoje = new Date();
  protected readonly comoData = computed(() => paraData(this.value()));

  /**
   * Onde o calendário abre quando o campo está vazio.
   *
   * Trinta anos atrás, e não hoje: a lista de anos mostra vinte e quatro por
   * vez, então abrir no ano corrente obrigaria quem nasceu nos anos noventa a
   * paginar para trás antes de ver o próprio ano.
   */
  protected readonly comecaEm = computed(
    () => this.comoData() ?? new Date(this.hoje.getFullYear() - 30, 0, 1),
  );

  protected readonly toIso = paraIso;
}
