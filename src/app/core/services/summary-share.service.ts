import { Injectable } from '@angular/core';
import { LinhaDoResumo, resumoEmTexto } from '../rules/session-summary-lines';

export interface ResumoParaCompartilhar {
  /** O vôlei: "Vôlei Unaerp". */
  readonly titulo: string;
  /** O dia: "seg 16 nov". */
  readonly subtitulo: string;
  readonly linhas: readonly LinhaDoResumo[];
}

/** O que aconteceu, para a tela dizer: o gesto não é o mesmo em todo aparelho. */
export type ResultadoDoCompartilhar = 'compartilhado' | 'baixado' | 'cancelado';

const LARGURA = 1080;
const ALTURA = 1350;
const MARGEM = 72;

/** As cores do app, em valor: o canvas não lê variável de CSS. */
const COR = {
  fundo: '#f2f2f3',
  tinta: '#1d1f20',
  acento: '#416180',
  acentoClaro: '#eef6ff',
  apagado: '#5d5d60',
  regua: '#d4d5d6',
} as const;

/**
 * O resumo da noite como imagem, para postar no grupo (ticket 03).
 *
 * `wa.me/?text=` só carrega texto: uma URL de WhatsApp não leva imagem. O
 * caminho é desenhar o resumo num canvas e entregar o PNG ao compartilhar do
 * próprio aparelho (`navigator.share` com arquivo), que é quem sabe abrir o
 * WhatsApp com a imagem anexada.
 *
 * Onde isso não existe — desktop, Firefox — a imagem é baixada e o WhatsApp
 * abre com o resumo em texto: a pessoa não fica sem nada, e a tela diz o que
 * aconteceu.
 */
@Injectable({ providedIn: 'root' })
export class SummaryShareService {
  async compartilhar(resumo: ResumoParaCompartilhar): Promise<ResultadoDoCompartilhar> {
    const imagem = await this.desenhar(resumo);
    const arquivo = new File([imagem], 'resumo-da-noite.png', { type: 'image/png' });
    const texto = resumoEmTexto(resumo, resumo.linhas);

    if (navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: resumo.titulo });
        return 'compartilhado';
      } catch (erro) {
        // Fechar a folha de compartilhar não é falha: a pessoa desistiu.
        if (erro instanceof DOMException && erro.name === 'AbortError') {
          return 'cancelado';
        }
        // Qualquer outra recusa cai no caminho de baixar, abaixo.
      }
    }

    const url = URL.createObjectURL(imagem);
    const link = document.createElement('a');
    link.href = url;
    link.download = arquivo.name;
    link.click();
    // O navegador precisa da URL viva até começar a baixar.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    return 'baixado';
  }

  /** O PNG do resumo: 1080 × 1350, a proporção que o WhatsApp não corta. */
  async desenhar(resumo: ResumoParaCompartilhar): Promise<Blob> {
    // A fonte que não carregou vira a fonte padrão do sistema no canvas, sem
    // erro nenhum — e a imagem sai feia na frente do grupo inteiro.
    await Promise.all([
      document.fonts.load('600 64px "Barlow Condensed"'),
      document.fonts.load('400 30px "Barlow"'),
    ]).catch(() => undefined);

    const canvas = document.createElement('canvas');
    canvas.width = LARGURA;
    canvas.height = ALTURA;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Este navegador não desenha a imagem do resumo.');
    }

    const titulo = '"Barlow Condensed", system-ui, sans-serif';
    const corpo = '"Barlow", system-ui, sans-serif';
    const util = LARGURA - 2 * MARGEM;

    ctx.fillStyle = COR.fundo;
    ctx.fillRect(0, 0, LARGURA, ALTURA);

    // Cabeçalho: a faixa do app, o vôlei e o dia.
    ctx.fillStyle = COR.acento;
    ctx.fillRect(0, 0, LARGURA, 16);

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COR.acento;
    ctx.font = `600 34px ${corpo}`;
    ctx.fillText(
      this.caber(ctx, `${resumo.titulo} · ${resumo.subtitulo}`.toUpperCase(), util),
      MARGEM,
      112,
    );

    ctx.fillStyle = COR.tinta;
    ctx.font = `600 104px ${titulo}`;
    ctx.fillText('RESUMO DA NOITE', MARGEM, 214);

    ctx.fillStyle = COR.regua;
    ctx.fillRect(MARGEM, 246, util, 3);

    // As linhas dividem o espaço que sobra: poucas ficam grandes, muitas cabem.
    const topo = 262;
    const rodape = 96;
    const linhas = resumo.linhas;
    const altura = Math.min(132, (ALTURA - topo - rodape) / Math.max(linhas.length, 1));
    const escala = altura / 132;

    linhas.forEach((linha, indice) => {
      const y = topo + indice * altura;

      if (indice % 2 === 1) {
        ctx.fillStyle = COR.acentoClaro;
        ctx.fillRect(MARGEM - 24, y, util + 48, altura);
      }

      let larguraDoNumero = 0;
      if (linha.figure !== undefined) {
        ctx.font = `600 ${Math.round(68 * escala)}px ${titulo}`;
        ctx.fillStyle = COR.acento;
        ctx.textAlign = 'right';
        const numero = String(linha.figure).toUpperCase();
        ctx.fillText(numero, LARGURA - MARGEM, y + altura * 0.68);
        larguraDoNumero = ctx.measureText(numero).width + 32;
        ctx.textAlign = 'left';
      }

      ctx.fillStyle = COR.apagado;
      ctx.font = `400 ${Math.round(28 * escala)}px ${corpo}`;
      ctx.fillText(this.caber(ctx, linha.label, util - larguraDoNumero), MARGEM, y + altura * 0.36);

      // O nome encolhe até caber: "RAFA + BIA × LÉO + CAROL" não pode ser
      // cortado no meio de quem está sendo parabenizado.
      ctx.fillStyle = COR.tinta;
      const valor = linha.value.toUpperCase();
      let corpoDoValor = Math.round(52 * escala);
      ctx.font = `600 ${corpoDoValor}px ${titulo}`;
      while (corpoDoValor > 24 && ctx.measureText(valor).width > util - larguraDoNumero) {
        corpoDoValor -= 2;
        ctx.font = `600 ${corpoDoValor}px ${titulo}`;
      }
      ctx.fillText(this.caber(ctx, valor, util - larguraDoNumero), MARGEM, y + altura * 0.78);
    });

    ctx.fillStyle = COR.apagado;
    ctx.font = `400 28px ${corpo}`;
    ctx.fillText('volei.site', MARGEM, ALTURA - 44);

    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('A imagem do resumo não saiu.'))),
        'image/png',
      ),
    );
  }

  /** Corta com reticências o que não coube nem encolhendo. */
  private caber(ctx: CanvasRenderingContext2D, texto: string, largura: number): string {
    if (ctx.measureText(texto).width <= largura) {
      return texto;
    }
    let corte = texto;
    while (corte.length > 1 && ctx.measureText(`${corte}…`).width > largura) {
      corte = corte.slice(0, -1);
    }
    return `${corte.trimEnd()}…`;
  }
}
