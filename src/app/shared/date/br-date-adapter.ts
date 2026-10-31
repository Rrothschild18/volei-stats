import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/** `23/07/1988`, `23-07-1988` ou `23071988`. */
const DIGITADA = /^(\d{1,2})\D?(\d{1,2})\D?(\d{4})$/;

/**
 * Datas em português, do jeito que se digita aqui.
 *
 * O adaptador nativo do Material usa `Date.parse`, que lê `23/07/1988` como
 * mês 23 — ou seja, não lê. Como estas telas pedem data de NASCIMENTO, digitar
 * é mais rápido que navegar trinta anos para trás no calendário, e digitar
 * precisa funcionar.
 */
@Injectable()
export class BrDateAdapter extends NativeDateAdapter {
  override parse(valor: unknown): Date | null {
    if (typeof valor !== 'string') {
      return super.parse(valor);
    }

    const partes = DIGITADA.exec(valor.trim());
    if (!partes) {
      return valor.trim() === '' ? null : super.parse(valor);
    }

    const [, dia, mes, ano] = partes;
    // Construído com componentes LOCAIS: `new Date('1988-07-23')` é meia-noite
    // em UTC, e a oeste de Greenwich isso vira o dia 22.
    const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

    // O `Date` acomoda 31/02 virando 02/03. Para uma data de nascimento isso é
    // erro de digitação, não intenção.
    const acomodou =
      data.getDate() !== Number(dia) ||
      data.getMonth() !== Number(mes) - 1 ||
      data.getFullYear() !== Number(ano);

    return acomodou ? null : data;
  }

  override format(data: Date, formato: object | string): string {
    if (formato === 'input') {
      const doisDigitos = (n: number) => String(n).padStart(2, '0');
      return `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)}/${data.getFullYear()}`;
    }
    return super.format(data, formato);
  }
}

/** O formato que o campo mostra e aceita. */
export const BR_DATE_FORMATS = {
  parse: { dateInput: 'input' },
  display: {
    dateInput: 'input',
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};
