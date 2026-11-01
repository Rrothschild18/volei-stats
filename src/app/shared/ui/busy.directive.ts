import { Directive, booleanAttribute, input } from '@angular/core';

/**
 * Marca um botão como "esperando resposta do banco".
 *
 * Só o aviso: `aria-busy`, que o leitor de tela anuncia, e que o CSS usa para
 * desenhar o indicador dentro do botão (`.btn[aria-busy='true']`).
 *
 * Desabilitar continua sendo decisão da tela. A condição dela quase nunca é só
 * a espera — campo vazio, nada selecionado, prazo vencido — e duas bindings
 * disputando `disabled` esconderiam essa regra.
 */
@Directive({
  selector: 'button[appBusy]',
  host: {
    '[attr.aria-busy]': 'busy() ? "true" : null',
  },
})
export class BusyDirective {
  readonly busy = input(false, { alias: 'appBusy', transform: booleanAttribute });
}
