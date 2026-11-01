# 36: O próximo sorteio sai durante a final

**What to build:** Quando a rodada 1 fechou e o par-ou-ímpar do encaixe já foi
decidido, nada do que vem depois muda o sorteio seguinte. Dá para tirar as
duplas do próximo campeonato enquanto a final está sendo jogada, voltar para
lançar o placar da final e, na classificação, já começar o próximo. Hoje esse
tempo é todo esperado em pé.

**Blocked by:** None (can start immediately)

**Status:** done

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

- [x] A prioridade do campeonato em andamento é lida quando a rodada 1 fechou,
      não há desempate pendente e o encaixe (se houver) foi aplicado
- [x] Um sorteio tirado antes dessa condição não acontece — não existe sorteio
      sem prioridade por omissão
- [x] Sorteio pendente é derivado do sorteio `selected` sem campeonato, sem
      coluna nova
- [x] USAR PROPOSTA volta para o campeonato ao vivo quando a final falta
- [x] A classificação oferece começar o próximo quando há sorteio pendente
- [x] Sorteio pendente com presença diferente da atual é apontado, não usado em
      silêncio
- [x] Correção que muda a prioridade invalida o sorteio pendente
- [x] Teste: prioridade lida do campeonato em andamento depois do fecho da
      rodada 1 bate com a lida dele depois de `completed`
- [x] Teste: sorteio pendente deixa de existir quando um campeonato passa a usá-lo

## Comments

**Implementado.** A condição virou `core/rules/priority-freeze.ts` (pura) +
`TournamentService.priorityFrozen()`, lida pelo portão do sorteio
(`DrawService.getPriorityEntries`) e pelo convite da tela ao vivo — uma
condição só, para que os dois nunca discordem.

O sorteio pendente virou `core/rules/pending-draw.ts`, derivado como o ticket
previu: sorteio `selected` da sessão que nenhum campeonato usa, o mais recente
vale. Sem coluna, sem migration, sem `status` novo. Descartar é deixar de ser
`selected` — o registro fica, porque ele aconteceu, e sai de uma vez do sorteio
pendente, das duplas repetidas do dia e da contagem de esperas, que leem as
mesmas linhas.

Três coisas que apareceram no caminho:

1. **O órfão antigo agora é limpo.** USAR PROPOSTA descarta o sorteio pendente
   anterior antes de gravar o novo, o que resolve de lado o órfão que já
   existia (quem voltava da tela de formato) sem coluna nenhuma.
2. **A prioridade persistida já estava gravada quando o portão abre.**
   `closeRound1()` e `applyOddPlayerPlacement()` escrevem no caminho de salvar
   placar (§7.5), e a condição só cai depois dos dois — então ler
   `priorityEntries` de um campeonato em andamento devolve o mesmo que ler dele
   depois de encerrado. É o que o teste compara.
3. **Nos formatos que abrem em semifinal ou final direta** (4 ou 2 duplas, sem
   encaixe) a eliminação direta não existe, e a prioridade está decidida desde a
   criação. A condição é verdadeira desde o início ali — e isso é correto, não
   permissivo: nada naquele campeonato muda o sorteio seguinte. O efeito prático
   é que o convite aparece logo, não perto do fim.

Começar o próximo, na classificação, exige também que a sessão não tenha
campeonato em andamento: a tela se alcança por URL com a bola em jogo, e dali
criar o próximo daria dois `'in-progress'` ao mesmo tempo.

REGRAS.md §3.1 foi reescrito: "vale apenas para `completed`" não é mais verdade.
O cenário do demo mudou de comportamento junto (o campeonato 2 está na
semifinal com o encaixe aplicado, então a prioridade do próximo sorteio já sai
dele, não do campeonato 1) — `demo-seed.spec.ts` registra isso.
