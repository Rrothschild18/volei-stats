import { ResumoDaSessao } from './session-summary';

/** Uma linha do resumo: o que é, de quem é e, quando há, o número. */
export interface LinhaDoResumo {
  readonly label: string;
  readonly value: string;
  readonly figure?: string | number;
}

/**
 * O resumo da noite em linhas prontas para mostrar — na tela, na imagem que vai
 * para o WhatsApp e no texto de quem não consegue mandar imagem. As três saem
 * daqui para dizerem a mesma coisa.
 */
export function linhasDoResumo(
  resumo: ResumoDaSessao,
  nomeDe: (playerId: string) => string,
): LinhaDoResumo[] {
  if (resumo.partidas === 0) {
    return [];
  }

  /** "Douglas e Wily"; com três ou mais, "Douglas, Wily e Kaio". */
  const nomes = (playerIds: readonly string[]): string => {
    const lista = playerIds.map(nomeDe);
    return lista.length <= 1
      ? (lista[0] ?? '?')
      : `${lista.slice(0, -1).join(', ')} e ${lista.at(-1)}`;
  };
  /** A dupla como ela aparece no resto do app: "Douglas + Wily". */
  const dupla = (playerIds: readonly string[]) => playerIds.map(nomeDe).join(' + ');

  const linhas: LinhaDoResumo[] = [
    {
      label: 'partidas jogadas',
      value: `${resumo.partidas} ${resumo.partidas === 1 ? 'jogo' : 'jogos'}`,
    },
  ];

  if (resumo.maisVitorias) {
    linhas.push({
      label: 'mais vitórias',
      value: nomes(resumo.maisVitorias.playerIds),
      figure: resumo.maisVitorias.valor,
    });
  }

  // Uma vitória não é sequência.
  if (resumo.maiorSequencia && resumo.maiorSequencia.valor > 1) {
    linhas.push({
      label: 'maior sequência',
      value: nomes(resumo.maiorSequencia.playerIds),
      figure: `${resumo.maiorSequencia.valor} seguidas`,
    });
  }

  if (resumo.maisTitulos) {
    linhas.push({
      label: resumo.maisTitulos.valor === 1 ? 'levantou a taça' : 'mais títulos',
      value: nomes(resumo.maisTitulos.playerIds),
      figure: resumo.maisTitulos.valor,
    });
  }

  // Pódio só diz alguma coisa quando alguém subiu mais de uma vez: com um
  // campeonato na noite, todo mundo que não foi último "tem um pódio".
  const maisPodios = resumo.podios.filter(
    (entrada) => entrada.valor > 1 && entrada.valor === resumo.podios[0]?.valor,
  );
  if (maisPodios.length > 0) {
    linhas.push({
      label: 'mais pódios',
      value: nomes(maisPodios.map((entrada) => entrada.playerId)),
      figure: maisPodios[0].valor,
    });
  }

  for (const campeao of resumo.campeoes) {
    linhas.push({
      label: `campeões · ${campeao.nome}`,
      value: dupla(campeao.playerIds),
      figure: campeao.placar ? `${campeao.placar.vencedor}×${campeao.placar.perdedor}` : '—',
    });
  }

  if (resumo.maisApertada) {
    linhas.push({
      label: 'partida mais apertada',
      value: `${dupla(resumo.maisApertada.vencedorIds)} × ${dupla(resumo.maisApertada.perdedorIds)}`,
      figure: `${resumo.maisApertada.placar.vencedor}×${resumo.maisApertada.placar.perdedor}`,
    });
  }

  if (resumo.fechouAQuadra.length > 0) {
    linhas.push({ label: 'fechou a quadra', value: nomes(resumo.fechouAQuadra) });
  }

  // O "≈" é o aviso: a duração sai do intervalo entre os placares lançados.
  if (resumo.duracaoMediaMin !== null) {
    linhas.push({ label: 'duração média da partida', value: `≈ ${resumo.duracaoMediaMin} min` });
  }

  return linhas;
}

/** O mesmo resumo em texto puro: é o que vai quando o aparelho não manda imagem. */
export function resumoEmTexto(
  cabecalho: { titulo: string; subtitulo: string },
  linhas: readonly LinhaDoResumo[],
): string {
  return [
    `*${cabecalho.titulo}* — ${cabecalho.subtitulo}`,
    '',
    ...linhas.map((linha) =>
      linha.figure === undefined
        ? `${linha.label}: ${linha.value}`
        : `${linha.label}: ${linha.value} (${linha.figure})`,
    ),
  ].join('\n');
}
