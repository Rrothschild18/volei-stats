import { Component, computed, inject, input, model, signal } from '@angular/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter } from '@angular/material/core';
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
 *
 * A regra que faz digitar funcionar: **data pela metade não mexe no modelo.**
 * O campo escreve de volta o que o modelo diz, então cada tecla que produzisse
 * um valor substituiria o que está sendo digitado. Enquanto a data não está
 * inteira, o que já valia continua valendo — e é só ao SAIR do campo que um
 * texto que não é data vira erro.
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
          [attr.aria-describedby]="descricao()"
          (input)="erro.set(null)"
          (dateInput)="aoDigitar($event)"
          (dateChange)="aoDigitar($event)"
          (blur)="aoSair($any($event.target).value)"
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

      <div aria-live="polite">
        @if (erro()) {
          <p [id]="fieldId() + '-erro'" class="mt-2 text-[12px] text-danger-800">
            {{ erro() }}
          </p>
        }
      </div>
    </div>
  `,
  host: { class: 'block' },
})
export class DateFieldComponent {
  private readonly adapter = inject<DateAdapter<Date>>(DateAdapter);

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

  /**
   * Preenchido só quando a pessoa sai do campo com um texto que não é data.
   *
   * Quem o apaga é o evento `input` cru do elemento, e não os eventos do
   * Material: estes só disparam quando a data MUDA, e corrigir "23/07" para
   * vazio não muda nada — os dois são "sem data". A mensagem ficava na tela
   * depois de a pessoa já ter limpado o campo.
   */
  protected readonly erro = signal<string | null>(null);

  protected readonly descricao = computed(() => {
    const ajuda = this.describedBy();
    const erro = this.erro() ? `${this.fieldId()}-erro` : '';
    return [ajuda, erro].filter(Boolean).join(' ') || null;
  });

  /**
   * A cada tecla.
   *
   * Três casos, e o terceiro é o que estava faltando:
   *   campo vazio  — a data foi apagada, e isso é uma informação
   *   data inteira — vale
   *   pela metade  — não é resposta nenhuma; o modelo fica como está, senão o
   *                  campo se reescreve por cima de quem está digitando
   */
  protected aoDigitar(event: MatDatepickerInputEvent<Date>): void {
    if (this.textoDe(event) === '') {
      this.value.set('');
      return;
    }

    if (event.value) {
      this.value.set(paraIso(event.value));
    }
  }

  /**
   * Ao sair do campo, a data pela metade deixa de ser "ainda estou digitando" e
   * passa a ser erro — dito em voz alta, e não apagado em silêncio.
   *
   * Lê o `blur` cru do elemento, e não o `dateChange` do Material: este só
   * dispara quando a data MUDA, e digitar "23/07" num campo que já estava vazio
   * não muda nada — os dois são "sem data". O erro nunca aparecia justamente
   * no caso mais comum, que é alguém digitando pela primeira vez.
   */
  protected aoSair(texto: string): void {
    const limpo = texto.trim();

    if (limpo === '') {
      this.erro.set(null);
      this.value.set('');
      return;
    }

    // A mesma leitura que o campo usa ao digitar: uma regra só, num lugar só.
    // `'input'` é o formato declarado em BR_DATE_FORMATS.parse.dateInput.
    const data = this.adapter.parse(limpo, 'input');
    if (data && this.adapter.isValid(data)) {
      this.erro.set(null);
      this.value.set(paraIso(data));
      return;
    }

    this.erro.set('Data incompleta. Use dia/mês/ano — por exemplo 23/07/1988.');
    this.value.set('');
  }

  private textoDe(event: MatDatepickerInputEvent<Date>): string {
    const alvo = event.targetElement as HTMLInputElement | null;
    return alvo?.value.trim() ?? '';
  }
}
