# 35: Corrigir um placar refaz o que dependia dele

**What to build:** Corrigir um placar da rodada 1 pode mudar quem empatou, quem foi eliminado e quem foi para o encaixe. Hoje a eliminação direta é refeita e o resto não — as decisões de par-ou-ímpar e o encaixe ficam congelados no resultado antigo, e num dos casos o app passa a decidir sozinho o que a regra diz que ele nunca decide.

Junto com isso: o que a correção invalida precisa SAIR, não ficar guardado ao
lado do resultado novo. E a correção tem prazo — 30 minutos depois do
campeonato encerrar, a noite está fechada.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## O que já é refeito

`closeRound1()` tem o padrão certo e diz por quê:

```
// Corrigir um placar da rodada 1 pode mudar quem saiu por mais pontos:
// a marca é refeita, não acumulada.
```

Ele desmarca a eliminação direta anterior, tira as prioridades dela e remarca.
É esse cuidado que falta nos outros dois lugares.

## 1. A decisão velha de par-ou-ímpar cala o empate novo

`tiebreakAt()` abre com um curto-circuito por TIPO, não por par:

```
if (decisions.some((decision) => decision.kind === kind)) {
  return null;
}
```

Então, havendo qualquer decisão de `losers` guardada, nenhum empate novo de
perdedores é detectado — mesmo entre outras duplas.

Reproduzido: rodada 1 de seis duplas, empate de perdedores entre t2 e t4,
par-ou-ímpar registrado. Corrige-se o primeiro jogo e quem passa a perder é t1.
O empate agora é entre **t1 e t4** — um par que ninguém decidiu. Resultado:

- `needsTiebreak` não aponta o empate dos perdedores;
- `losers[0]` vira `t1` **pela ordem das partidas**, e é ele quem é eliminado
  direto.

Ou seja: o app escolhe quem sai. REGRAS.md §9.3 diz o contrário — "o app não
escolhe sozinho: as duplas fazem par-ou-ímpar e alguém registra".

Nota de quem reproduziu: nesse cenário o que sobrou visível foi o empate dos
**vencedores**, que estava atrás na fila. Isso disfarça o problema — a tela pausa
por outro motivo, e parece que está tudo certo.

## 2. O encaixe não é refeito

`applyOddPlayerPlacement()` sai na porta quando já existe decisão:

```
if (!tournament.waitingPlayerId || tournament.oddPlayerPlacement) {
  return tournament;
}
```

E `closeRound1()` devolve cedo quando o campeonato usa encaixe. Então, depois
que o par-ou-ímpar do encaixe foi aplicado, corrigir a rodada 1 não revisita
nada: a **dupla sintética continua montada com os jogadores da dupla que já não
é a que perdeu por menos**, e a prioridade `coin-flip-loss` continua no jogador
errado.

## 3. O que a correção invalida precisa sair

Hoje `correctScore` grava o placar novo e chama `closeRound1`. Nada é apagado.
Tudo o que foi derivado do resultado antigo continua no banco, ao lado do novo:

- **Partidas que não existiriam mais.** Mudar quem venceu a rodada 1 muda quem
  se enfrenta na semifinal e na final. As partidas já lançadas dessas fases
  foram jogadas entre duplas que o resultado corrigido não manda mais para lá.
  `findSavedMatch` casa por fase **e** par de duplas, então elas não são
  reconhecidas, não são apagadas e continuam contando nas estatísticas, nos
  rankings e no saldo da classificação.
- **A classificação final.** `finalStandings` é gravada uma vez em
  `finishIfComplete` e nunca mais recalculada; `finishIfComplete` nem é chamada
  no caminho da correção.
- **`status: 'completed'`.** Se a correção reabre a chave, o campeonato continua
  marcado como encerrado.
- **As prioridades do próximo sorteio.** `priorityEntries` acumula; `closeRound1`
  limpa as de eliminação direta, as outras ficam.

A regra é uma só, e vale para os três achados: **o que depende de um resultado
é derivado de novo, e o que não sobrevive é apagado.** Nada de resultado antigo
"desconsiderado" na prática mas presente no banco — o que não vale tem de sair,
senão volta a aparecer numa soma qualquer.

Vale verificar no `on delete` das partidas no Supabase se apagar partida de fase
posterior é permitido pelo schema atual.

## 4. Prazo para corrigir: 30 minutos

Corrigir um campeonato encerrado hoje não tem prazo nenhum — o botão "Errou um
placar?" na classificação abre para sempre. Mas um campeonato de duas semanas
atrás já virou ranking, prioridade e estatística de todo mundo; mexer nele é
reescrever o passado de gente que não está ali.

Prazo: **30 minutos depois de o campeonato encerrar.** Depois disso o campeonato
é só leitura.

- O corte é sobre o campeonato, não sobre a sessão: conta do fim da final
  (`playedAt` da final, o mesmo instante que `tournamentTiming` já calcula).
- Enquanto o campeonato está rolando, corrigir vale sem prazo.
- Passado o prazo, o botão de corrigir sai da tela — não fica desabilitado com
  tooltip. E a tela diz por que: "Este campeonato fechou. Placar só até 30 min
  depois do fim."
- O corte não pode valer só na tela: o caminho de correção na store recusa a
  gravação fora do prazo. É a mesma lição do ticket 32 — se a tela é a única
  guardiã, o estado errado entra por outro caminho.
- O dono continua podendo **excluir** o campeonato depois do prazo. Excluir já
  tem confirmação e já diz que some das prioridades e estatísticas; é a saída
  honesta para um resultado que ninguém pode mais consertar.

## O que decidir ao implementar

Uma correção que invalida uma decisão de quadra não pode ser desfeita em
silêncio — alguém fez aquele par-ou-ímpar na beira da quadra. Duas saídas, e o
ticket precisa escolher uma:

1. **Descartar e repedir**: a decisão que não corresponde mais ao empate atual é
   apagada, a chave pausa e pede outro par-ou-ímpar. Honesto e simples de
   explicar; obriga a repetir o gesto.
2. **Manter quando ainda couber**: a decisão sobrevive se as duplas que ela
   nomeia continuarem empatadas entre si; caso contrário é descartada. Menos
   repetição, mais regra para explicar.

A recomendação é a **1**, pelo mesmo motivo que `eliminated` virou estado
derivado no ticket 32: decisão guardada que ninguém revalida é a fonte do
problema, não a solução.

Seja qual for, a tela precisa **dizer** que a correção derrubou a decisão, em
vez de a chave voltar a pausar sem explicação.

- [ ] A decisão de par-ou-ímpar só vale para o empate que a gerou; empate novo
      entre outras duplas pausa a chave de novo
- [ ] O curto-circuito por tipo em `tiebreakAt` deixa de existir
- [ ] Corrigir a rodada 1 revisita o encaixe: dupla sintética e prioridade
      `coin-flip-loss` acompanham o resultado novo
- [ ] A tela avisa quando uma correção derrubou uma decisão de quadra
- [ ] Teste: empate decidido → correção muda o par → a chave pausa pedindo outro
- [ ] Teste: empate decidido → correção não muda o par → a decisão continua valendo
- [ ] Teste: correção depois do encaixe aplicado refaz a dupla sintética
- [ ] Corrigir a rodada 1 apaga as partidas de fases posteriores que o resultado
      novo não produz mais
- [ ] `finalStandings`, `status` e as prioridades são re-derivados na correção,
      não acumulados
- [ ] Teste: correção que muda quem vai à final não deixa para trás a final
      antiga contando no saldo e nos rankings
- [ ] Corrigir vale até 30 min depois do fim do campeonato; passado o prazo o
      botão sai e a tela explica
- [ ] A store recusa a correção fora do prazo, não só a tela
- [ ] Teste: correção 31 min depois do fim é recusada na store
