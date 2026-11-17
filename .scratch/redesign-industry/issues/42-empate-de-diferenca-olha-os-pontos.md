# 42: Empate de diferença olha os pontos antes de parar a chave

**What to build:** Hoje a rodada 1 é lida só pela DIFERENÇA de pontos. Dois
jogos com a mesma diferença param a chave e pedem par-ou-ímpar, mesmo quando um
deles foi um jogo maior — e quem fez mais pontos deveria passar na frente sem
sorteio nenhum. O par-ou-ímpar continua existindo, mas só quando diferença **e**
pontos a favor empatam.

**Blocked by:** None (can start immediately)

**Status:** done

## O comportamento relatado

> "Jogo A 12 × 10, jogo B 14 × 12. Embora a diferença seja 2 pontos nos dois, o
> time que ganhou de 14 vai para a final, e dos perdedores não se tira par-ou-ímpar."

Hoje a chave pausa duas vezes nesse cenário (vencedores e perdedores), e as duas
são desnecessárias: os jogos não foram iguais.

## Onde está

`src/app/core/rules/round-1-outcome.ts` é o único lugar que decide isto. Tudo o
mais passa por ele:

- `TournamentService.pendingTiebreak()` → pausa a chave;
- `TournamentService.resolvePlacementTeams()` → quem vai ao encaixe e quem é
  eliminado direto;
- `LiveTournamentStore` → a escada, a fila e as frases "direto à final" / "fora".

O tipo que carrega a informação é pequeno e é onde falta o dado:

```ts
export interface RankedTeam {
  readonly id: string;
  readonly diff: number;   // só isto
}
```

E `readRound1` monta as listas jogando fora o placar:

```ts
.map((match) => ({ id: match.winnerId!, diff: match.pointDifference }))
```

`Match` já tem `scoreA` e `scoreB` — o dado existe, só não é lido. No banco,
`point_difference` é coluna gerada, e `score_a`/`score_b` estão lá: nada de
migration para este ticket.

## A regra nova

`RankedTeam` ganha `points`: os pontos que **aquela dupla** fez na partida
(`winnerId` → o maior placar; `loserId` → o menor).

Ordenação, nas duas listas, nesta ordem:

1. maior diferença primeiro (como hoje);
2. empatou a diferença → **mais pontos a favor fica acima**;
3. empatou os dois → par-ou-ímpar, como hoje (REGRAS.md §9.3).

O que "acima" significa já está escrito e não muda:

- **Vencedores**: o primeiro vai direto à final.
- **Perdedores**: a lista é do pior para o melhor — `losers[0]` é a eliminação
  direta e o último disputa o encaixe. Com pontos a favor iguais em diferença,
  **quem fez menos pontos é o eliminado direto**.

No exemplo:

```
Jogo A: 12 × 10  (+2)        Jogo B: 14 × 12  (+2)

VENCEDORES  diff  pts                PERDEDORES  diff  pts
  B(14)      +2    14  → FINAL         A(10)      −2    10  → FORA (direta)
  A(12)      +2    12  → semi          B(12)      −2    12  → encaixe / par-ou-ímpar
```

Nenhuma pausa. O par-ou-ímpar só aparece em 12 × 10 **e** 12 × 10.

## O que muda em código

- `RankedTeam` ganha `points`.
- `rank()` compara `diff`, depois `points`, e só então consulta a decisão de
  quadra guardada.
- `tiesAt()` passa a agrupar por `(diff, points)`, e não só por `diff` — é ele
  quem decide se existe empate na fronteira. Sem isto, a chave continua pausando.
- A decisão de par-ou-ímpar guardada (`TiebreakDecision.teamIds`) continua
  valendo só para o par exato que a gerou. `staleDecisions` passa a derrubar,
  de graça, a decisão que uma correção de placar transformou em não-empate por
  pontos — é o caminho do ticket 35 e não precisa de código novo.

## Cuidado com o jogo interrompido

`final-score.ts` aceita jogo que parou antes do limite (acabou o horário,
começou a chover). Então 8 × 6 e 12 × 10 podem coexistir na mesma rodada: mesma
diferença, pontos diferentes. Com esta regra, o 12 × 10 passa na frente. É o
comportamento desejado e vale escrever o teste, porque é o caso que mais
assusta em quadra.

## REGRAS.md

§7.7 e §9.3 dizem hoje que empate de diferença vai direto ao par-ou-ímpar. As
duas precisam passar a dizer: **diferença → pontos a favor → par-ou-ímpar**.

- [x] `RankedTeam` carrega os pontos a favor da dupla naquela partida
- [x] `rank()` desempata por pontos a favor antes de olhar decisão de quadra
- [x] `tiesAt()` agrupa por diferença **e** pontos: 12×10 vs 14×12 não é empate
- [x] Teste: 12×10 e 14×12 → nenhum par-ou-ímpar; B(14) à final, A(10) fora
- [x] Teste: 12×10 e 12×10 → par-ou-ímpar nas duas fronteiras, como hoje
- [x] Teste: jogo interrompido 8×6 vs 12×10 → o 12×10 passa à frente
- [x] Teste: três jogos, empate total em dois e um terceiro diferente → só o par
      realmente empatado pausa a chave
- [x] Teste: correção que desfaz o empate por pontos derruba a decisão guardada
      (`staleDecisions`)
- [x] REGRAS.md §7.7 e §9.3 atualizadas

## Comments

Feito. A regra inteira coube em `round-1-outcome.ts`, como o ticket previa:
`RankedTeam` ganhou `points`, `rank()` compara os pontos com **sinal invertido
entre as listas** (entre vencedores, mais pontos vem primeiro; entre perdedores,
o primeiro é a eliminação direta, então quem fez menos é que vem antes), e
`tiesAt()` passou a agrupar por diferença **e** pontos.

Quatro testes antigos caíram, e os quatro eram o mesmo caso: usavam placares
diferentes de mesma diferença (12 × 9 contra 11 × 8) para exercitar o
par-ou-ímpar. Exatamente o que este ticket deixou de ser empate. Passaram a usar
placares iguais, e o teste "correção que não muda o par" mudou de ideia junto:
agora corrige o jogo que **não** participa de empate nenhum, que é a única forma
honesta de dizer "mesmos empates, outros números".

A folha do desempate mudou de nome — "EMPATE NA DIFERENÇA" virou "MESMO PLACAR"
— porque é isso que ela passou a significar: a diferença sozinha já não traz
ninguém até aqui. O e2e `sorteio-adiantado.spec.ts` acompanhou (o cenário dele
continua empate de verdade: os dois jogos vão a 12 × 10).
