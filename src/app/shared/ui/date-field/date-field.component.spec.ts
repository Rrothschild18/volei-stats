import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { BR_DATE_FORMATS, BrDateAdapter } from '../../date/br-date-adapter';
import { DateFieldComponent } from './date-field.component';

/**
 * O defeito que isto fecha, e que só aparece digitando TECLA A TECLA:
 *
 * o campo escreve de volta o que o adaptador entendeu, e o adaptador nativo
 * responde alguma coisa para quase tudo. Digitar "2" virava "01/02/2001" na
 * tela, a tecla seguinte caía em cima disso, e "23071988" terminava com o
 * campo vazio. Um teste que preenche o campo de uma vez não vê nada disso —
 * por isso aqui as teclas entram uma por uma.
 */
@Component({
  imports: [DateFieldComponent],
  template: `
    <app-date-field fieldId="nascimento" label="Sua data de nascimento" [(value)]="data" />
  `,
})
class HospedeiroDeTeste {
  readonly data = signal('');
}

describe('DateFieldComponent', () => {
  function setup(): {
    fixture: ComponentFixture<HospedeiroDeTeste>;
    host: HospedeiroDeTeste;
    input: HTMLInputElement;
    digitar: (texto: string) => void;
    sair: () => void;
  } {
    TestBed.configureTestingModule({
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
        { provide: DateAdapter, useClass: BrDateAdapter, deps: [MAT_DATE_LOCALE] },
        { provide: MAT_DATE_FORMATS, useValue: BR_DATE_FORMATS },
      ],
    });

    const fixture = TestBed.createComponent(HospedeiroDeTeste);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    /** Uma tecla por vez, com a detecção de mudanças entre elas. */
    function digitar(texto: string): void {
      for (const tecla of texto) {
        input.value += tecla;
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      }
    }

    function sair(): void {
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    }

    return { fixture, host: fixture.componentInstance, input, digitar, sair };
  }

  it('o texto digitado sobrevive a cada tecla', () => {
    const { input, digitar } = setup();

    digitar('23/07/1988');

    expect(input.value).toBe('23/07/1988');
  });

  it('e o campo não inventa data no meio do caminho', () => {
    const { input, digitar } = setup();
    const vistos: string[] = [];

    for (const tecla of '23/07/1988') {
      digitar(tecla);
      vistos.push(input.value);
    }

    expect(vistos).toEqual([
      '2',
      '23',
      '23/',
      '23/0',
      '23/07',
      '23/07/',
      '23/07/1',
      '23/07/19',
      '23/07/198',
      '23/07/1988',
    ]);
  });

  it('data inteira chega ao modelo como aaaa-mm-dd', () => {
    const { host, digitar, sair } = setup();

    digitar('23/07/1988');
    sair();

    expect(host.data()).toBe('1988-07-23');
  });

  it('sem separador também vale, e o campo normaliza', () => {
    const { host, input, digitar, sair } = setup();

    digitar('23071988');
    sair();

    expect(host.data()).toBe('1988-07-23');
    expect(input.value).toBe('23/07/1988');
  });

  it('enquanto a data está pela metade, o modelo não é tocado', () => {
    const { host, digitar } = setup();

    digitar('23/07');

    expect(host.data()).toBe('');
  });

  it('sair com a data pela metade é erro dito, não apagão silencioso', () => {
    const { fixture, host, digitar, sair } = setup();

    digitar('23/07');
    sair();

    expect(host.data()).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Data incompleta');
  });

  it('e o erro some assim que a pessoa volta a digitar', () => {
    const { fixture, digitar, sair } = setup();

    digitar('23/07');
    sair();
    digitar('/1988');

    expect(fixture.nativeElement.textContent).not.toContain('Data incompleta');
  });

  it('apagar o campo apaga a data, e não deixa erro para trás', () => {
    const { fixture, host, input, digitar, sair } = setup();

    digitar('23/07/1988');
    sair();
    expect(host.data()).toBe('1988-07-23');

    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    sair();

    expect(host.data()).toBe('');
    expect(fixture.nativeElement.textContent).not.toContain('Data incompleta');
  });

  it('data que não existe não é acomodada', () => {
    const { host, digitar, sair } = setup();

    digitar('31/02/1990');
    sair();

    expect(host.data()).toBe('');
  });
});
