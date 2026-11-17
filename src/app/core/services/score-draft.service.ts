import { Injectable } from '@angular/core';
import { MatchOpening } from '../rules/match-opening';

/**
 * O placar que ainda não foi salvo: pontos, sequência de ralis, de quem é o
 * saque e o início do jogo.
 */
export interface RascunhoDePlacar {
  readonly scoreA: number;
  readonly scoreB: number;
  /** A dupla que ganhou cada rali, desde o 0 × 0. Nulo = a ordem se perdeu. */
  readonly ralis: readonly string[] | null;
  /** De onde a bola está sendo acompanhada; nulo = ninguém marcou o saque. */
  readonly saque: { readonly teamId: string; readonly rallies: readonly string[] } | null;
  /** Quem saca primeiro em cada dupla, quando alguém trocou o padrão. */
  readonly primeiros: Readonly<Record<string, string>>;
  readonly opening: MatchOpening;
}

interface Vaga {
  readonly phase: string;
  readonly teamAId: string;
  readonly teamBId: string;
}

/**
 * Guarda o placar em andamento NESTE aparelho.
 *
 * Antes, fechar a folha de placar jogava a contagem fora — e ninguém conta
 * ponto a ponto se um toque fora da folha zera tudo. Quem acompanha o saque
 * precisa poder sair para ver a chave e voltar.
 *
 * É local de propósito: o placar só vira verdade do grupo quando alguém salva
 * (o primeiro salvo trava). Dois aparelhos contando o mesmo jogo têm cada um o
 * seu rascunho, e vale o de quem salvar primeiro — como já era.
 */
@Injectable({ providedIn: 'root' })
export class ScoreDraftService {
  ler(vaga: Vaga): RascunhoDePlacar | null {
    try {
      const bruto = localStorage.getItem(this.chave(vaga));
      return bruto ? (JSON.parse(bruto) as RascunhoDePlacar) : null;
    } catch {
      // Aba anônima, armazenamento bloqueado ou JSON velho: sem rascunho.
      return null;
    }
  }

  guardar(vaga: Vaga, rascunho: RascunhoDePlacar): void {
    try {
      localStorage.setItem(this.chave(vaga), JSON.stringify(rascunho));
    } catch {
      // Sem onde guardar, a folha funciona como antes: vale enquanto aberta.
    }
  }

  apagar(vaga: Vaga): void {
    try {
      localStorage.removeItem(this.chave(vaga));
    } catch {
      // Nada a apagar.
    }
  }

  /** Os ids das duplas são únicos por campeonato: a vaga já identifica o jogo. */
  private chave(vaga: Vaga): string {
    return `voleistats.placar.${vaga.teamAId}.${vaga.teamBId}.${vaga.phase}`;
  }
}
