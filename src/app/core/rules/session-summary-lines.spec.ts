import { describe, expect, it } from 'vitest';
import { linhasDoResumo, resumoEmTexto } from './session-summary-lines';
import { ResumoDaSessao } from './session-summary';

const nomes: Record<string, string> = { bia: 'Bia', rafa: 'Rafa', leo: 'Léo', carol: 'Carol' };
const nomeDe = (id: string) => nomes[id] ?? '?';

const resumo: ResumoDaSessao = {
  partidas: 7,
  maisVitorias: { playerIds: ['bia'], valor: 5 },
  maiorSequencia: { playerIds: ['bia'], valor: 4 },
  maisTitulos: { playerIds: ['bia', 'rafa'], valor: 1 },
  podios: [
    { playerId: 'bia', valor: 1 },
    { playerId: 'rafa', valor: 1 },
  ],
  campeoes: [
    {
      tournamentId: 't1',
      nome: 'Saca ni mim Douglas',
      playerIds: ['rafa', 'bia'],
      placar: { vencedor: 12, perdedor: 9 },
    },
  ],
  fechouAQuadra: ['bia', 'leo'],
  maisApertada: {
    matchId: 'm1',
    tournamentId: 't1',
    diferenca: 2,
    vencedorIds: ['rafa', 'bia'],
    perdedorIds: ['leo', 'carol'],
    placar: { vencedor: 12, perdedor: 10 },
  },
  duracaoMediaMin: 9,
};

describe('linhasDoResumo', () => {
  it('põe os destaques na ordem do mural, com nomes e números', () => {
    const linhas = linhasDoResumo(resumo, nomeDe);

    expect(linhas.map((linha) => linha.label)).toEqual([
      'partidas jogadas',
      'mais vitórias',
      'maior sequência',
      'levantou a taça',
      'campeões · Saca ni mim Douglas',
      'partida mais apertada',
      'fechou a quadra',
      'duração média da partida',
    ]);
    expect(linhas[3]).toEqual({ label: 'levantou a taça', value: 'Bia e Rafa', figure: 1 });
    expect(linhas[5].value).toBe('Rafa + Bia × Léo + Carol');
    expect(linhas[7].value).toBe('≈ 9 min');
  });

  it('pódio só entra quando alguém subiu mais de uma vez', () => {
    const comPodio = linhasDoResumo(
      {
        ...resumo,
        podios: [
          { playerId: 'bia', valor: 3 },
          { playerId: 'rafa', valor: 2 },
        ],
      },
      nomeDe,
    );

    expect(comPodio.find((linha) => linha.label === 'mais pódios')).toEqual({
      label: 'mais pódios',
      value: 'Bia',
      figure: 3,
    });
    expect(linhasDoResumo(resumo, nomeDe).some((linha) => linha.label === 'mais pódios')).toBe(
      false,
    );
  });

  it('noite sem partida não tem linha nenhuma', () => {
    expect(linhasDoResumo({ ...resumo, partidas: 0 }, nomeDe)).toEqual([]);
  });
});

describe('resumoEmTexto', () => {
  it('vira um texto de WhatsApp, com o número entre parênteses', () => {
    const texto = resumoEmTexto({ titulo: 'Vôlei Segunda', subtitulo: 'seg 16 nov' }, [
      { label: 'mais vitórias', value: 'Bia', figure: 5 },
      { label: 'fechou a quadra', value: 'Bia e Léo' },
    ]);

    expect(texto).toBe(
      '*Vôlei Segunda* — seg 16 nov\n\nmais vitórias: Bia (5)\nfechou a quadra: Bia e Léo',
    );
  });
});
