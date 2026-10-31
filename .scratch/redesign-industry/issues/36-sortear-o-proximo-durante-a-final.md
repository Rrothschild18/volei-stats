# 36: O próximo sorteio sai durante a final

**What to build:** Quando a rodada 1 fechou e o par-ou-ímpar do encaixe já foi
decidido, nada do que vem depois muda o sorteio seguinte. Dá para tirar as
duplas do próximo campeonato enquanto a final está sendo jogada, voltar para
lançar o placar da final e, na classificação, já começar o próximo. Hoje esse
tempo é todo esperado em pé.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Por que isso é possível (e não é palpite)

As entradas do sorteio são duas, e as duas congelam antes da final:

**Prioridades.** `TournamentPriorityEntry.reason` tem exatamente três valores, e
cada um nasce num lugar que já passou quando a final começa:

| motivo | onde nasce |
| --- | --- |
| `direct-elimination` | `closeRound1()` |
| `coin-flip-loss` | `applyOddPlayerPlacement()` |
| `waiting-player-not-used` | criação do campeonato |

Semifinal e final não geram prioridade nenhuma. Quem perde a final não ganha
preferência — e não deveria: ele jogou a noite inteira.

**Duplas repetidas.** `getExistingPairsInSession()` lê as duplas dos
campeonatos da sessão, e elas existem desde o sorteio daquele campeonato.

## O portão é uma linha, e ele mente em silêncio

`draw.service.ts:138` filtra `status === 'completed'`. Não é regra de vôlei: é
de onde a prioridade é lida. Um sorteio tirado hoje durante a final sai **sem
prioridade nenhuma, sem avisar** — o eliminado direto não entra na rodada 1 e
ninguém percebe. É por isso que o portão não pode só ser aberto: ele tem de ser
trocado por uma condição que saiba a diferença entre "ainda vai mudar" e "já
está decidido".

**A condição:** as prioridades de um campeonato em andamento valem para o
sorteio quando

1. a rodada 1 fechou — toda partida de `generateInitialMatches()` tem placar;
2. não há desempate pendente (`pendingTiebreak` nulo);
3. se o campeonato usa encaixe, o par-ou-ímpar já foi aplicado
   (`oddPlayerPlacement` preenchido).

Isso é mais preciso que "só falta a final", e é o mesmo cálculo para qualquer
formato do catálogo — num formato de três partidas na rodada 1 a condição cai
mais tarde que num de duas, sozinha, sem tabela de exceção. `LiveTournamentStore`
já tem as três peças (`paused`, `tiebreak`, `placementCandidate`).

## O "sorteio pendente" não precisa de coluna nova

`useProposal()` já grava o `DrawProposal` com `selected: true` e já o põe em
`session.drawIds`. O campeonato é que só nasce na tela de formato, com
`drawId` apontando para ele.

Então **sorteio pendente = sorteio `selected` da sessão que nenhum campeonato
está usando**. Puro derivado, sem migration, sem `status` novo — e sem o risco
de dois campeonatos `'in-progress'` na mesma sessão, que é o que criar o
campeonato adiantado provocaria (`status` só tem dois valores).

Um detalhe a decidir: **sorteio órfão já existe hoje.** Quem toca em USAR
PROPOSTA e volta da tela de formato deixou um sorteio gravado sem campeonato.
Depois deste ticket, esse órfão passa a ser lido como "o próximo está pronto".
Recomendação: contar só o órfão **mais recente** da sessão, e dar como desfazer
("descartar este sorteio") onde ele aparece — em vez de inventar uma coluna para
distinguir órfão de proposital.

## O caminho

1. Durante a final, a tela do campeonato ao vivo oferece sortear o próximo
   (ticket 37 cuida de como esse convite aparece).
2. Vai para o sorteio de sempre — a mesma tela, as mesmas três propostas, a
   mesma troca por toque. Nada de tela nova.
3. USAR PROPOSTA grava como já grava. **Mas volta para o campeonato ao vivo**,
   não para a tela de formato: a final ainda precisa de placar. Precisa de um
   retorno explícito, porque hoje `useProposal()` navega direto para `novo`.
4. Lança o placar da final. O campeonato encerra e abre a classificação, como
   hoje.
5. Na classificação, o botão da barra deixa de ser "NOVO SORTEIO" e passa a
   dizer que o próximo já está sorteado — leva para a tela de formato daquele
   sorteio, e dali para o ao vivo.

O passo 5 é o que entrega o ganho: o sorteio, que é a parte lenta (três
propostas, trocas, "de novo", conversa), já aconteceu enquanto a bola rolava.

## Bordas

- **Presença mudou depois do sorteio adiantado.** Alguém foi embora, alguém
  chegou. O sorteio pendente aponta para gente que não está mais lá, ou deixa de
  fora quem chegou. A tela precisa comparar com a presença atual e dizer; o
  sorteio pendente não pode virar campeonato com gente ausente.
- **Correção de placar.** O ticket 35 dá 30 min para corrigir, e uma correção na
  rodada 1 pode mudar a eliminação direta — ou seja, a prioridade de que o
  sorteio pendente nasceu. O sorteio pendente precisa ser invalidado junto, pelo
  mesmo princípio: o que depende de um resultado é derivado de novo.
- **Sortear duas vezes.** Nada impede tirar outro sorteio por cima do pendente.
  O mais recente vale; o anterior é descartado, não acumulado.

- [ ] A prioridade do campeonato em andamento é lida quando a rodada 1 fechou,
      não há desempate pendente e o encaixe (se houver) foi aplicado
- [ ] Um sorteio tirado antes dessa condição não acontece — não existe sorteio
      sem prioridade por omissão
- [ ] Sorteio pendente é derivado do sorteio `selected` sem campeonato, sem
      coluna nova
- [ ] USAR PROPOSTA volta para o campeonato ao vivo quando a final falta
- [ ] A classificação oferece começar o próximo quando há sorteio pendente
- [ ] Sorteio pendente com presença diferente da atual é apontado, não usado em
      silêncio
- [ ] Correção que muda a prioridade invalida o sorteio pendente
- [ ] Teste: prioridade lida do campeonato em andamento depois do fecho da
      rodada 1 bate com a lida dele depois de `completed`
- [ ] Teste: sorteio pendente deixa de existir quando um campeonato passa a usá-lo
