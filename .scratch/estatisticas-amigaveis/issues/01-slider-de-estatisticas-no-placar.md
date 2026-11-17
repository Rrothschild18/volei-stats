# 01: Slider de estatísticas no lugar do aviso de 0 × 0

**What to build:** Na tela de lançar placar, o aviso *"Ninguém jogou 0 × 0.
Lance o placar da partida."* e o parágrafo *"Limite: 12 pontos, com dois de
diferença…"* saem. No lugar entra um **slider** que o jogador arrasta para o
lado, com as estatísticas das duas duplas que estão em quadra.

**Blocked by:** None (can start immediately)

**Status:** done

## O que sai, e por quê

```
score-sheet.component.ts:279   case 'zero': 'Ninguém jogou 0 × 0. Lance o placar da partida.'
score-sheet.component.ts:143   <p>Limite: {{ pointLimit() }} pontos, com dois de diferença — …</p>
```

O 0 × 0 **não é erro**: é o estado inicial da tela. O botão SALVAR já nasce
desabilitado (`[disabled]="!!error() || busy()"`), então a frase só ocupa o
lugar mais nobre da tela para dizer o óbvio.

O parágrafo do limite também é dispensável: o `+` de cada lado já para no teto
certo pela regra do jogo (`maxA()`/`maxB()` → `scoreCeiling()`), então a regra
está aplicada, não só anunciada.

**As outras três mensagens ficam** — elas corrigem erro de verdade:
`tie` ("vôlei não tem empate"), `needs-two` ("em 12 não acaba por um ponto") e
`past-limit` ("teria parado em X × Y").

## O que entra

Um slider de cartões, arrastável, nesta ordem:

1. **Esta dupla** (lado A) — quantas vezes jogaram juntos, vitórias juntos,
   média de pontos.
2. **A outra dupla** (lado B) — o mesmo.
3. **Vocês já se encararam** — jogador × jogador em lados opostos, com o
   retrospecto de cada cruzamento.
4. **Números do jogo** — fase, limite de pontos, média de pontos nessa fase.

### Não construa confronto de dupla × dupla

Nos 32 jogos reais do Vôlei Unaerp: **32 confrontos distintos em 32 partidas** —
a mesma dupla contra a mesma dupla nunca aconteceu, e não vai acontecer, porque
o sorteio tira **−50 por dupla repetida** (REGRAS §2.4). Um cartão de "quem
ganhou mais vezes entre estas duas duplas" mostraria 0 e vazio em praticamente
todo jogo.

O que tem dado, no mesmo recorte: Douglas+Wily 5 jogos juntos, Douglas+Kaio 4,
Pedrão+Wily 3; e 65 pares de adversários, 16 deles com 3 cruzamentos ou mais
(Kaio×Wily 5x). É daí que os cartões 1, 2 e 3 saem.

Quando o confronto de duplas for inédito — quase sempre — o cartão 3 diz
"primeira vez que essas duas duplas se encontram" em vez de um zero.

## De onde vêm os números

`team_stats` (dupla pelo **par** de jogadores) já dá o cartão 1 e 2:

```
stats.repository.ts  →  from('team_stats').select('player1_id, player2_id, games_played, wins, …')
```

O cartão 3 (jogador × jogador em lados opostos) **não existe em nenhuma view**.
Duas saídas, na ordem de preferência:

1. View nova `player_head_to_head` (group_id, player_a, player_b, jogos,
   vitórias de a) — mesma forma de `team_stats`, migration pequena;
2. Derivar no cliente a partir de `player_match_results` + `tournament_teams`.

A média de pontos precisa de `matches.score_a/score_b`, que as views de hoje
não expõem agregadas por dupla.

## Acessibilidade (obrigatório)

- Arrastar **não pode ser o único caminho**: setas visíveis + navegação por
  teclado (←/→) + `scroll-snap` para o gesto.
- `aria-roledescription="carrossel"`, cada cartão com `aria-label` de posição
  ("2 de 4"), e a troca anunciada em `aria-live="polite"`.
- A tela é um `role="dialog"` com `appFocusTrap`: o slider entra na ordem de
  foco **depois** dos steppers de placar, que são o que a pessoa veio fazer.
- Precisa passar no AXE e no contraste AA, como o resto.

## Cuidado de carregamento

A tela abre no meio do jogo, muitas vezes com 4G ruim na quadra. O slider
**não pode atrasar o lançamento do placar**: os cartões carregam depois, com
`app-skeleton`, e falha de carga esconde o slider em silêncio em vez de mostrar
erro — o placar continua lançável.

- [x] Aviso de `zero` e parágrafo do limite removidos
- [x] `tie`, `needs-two` e `past-limit` continuam aparecendo
- [x] Slider com os 4 cartões, arrastável e por teclado
- [x] Cartão de confronto diz "primeira vez" quando o par de duplas é inédito
- [x] Números vêm de view (ou derivação) sem travar a tela
- [x] AXE limpo, foco depois dos steppers, troca de cartão anunciada
- [x] Teste: placar continua salvável com o slider em erro de carga

## Perguntas abertas

- **Média de pontos**: dos pontos que a dupla fez, ou do placar total do jogo?
- O slider olha a **janela de 4 sessões** (ticket 04) ou o histórico completo?

## Comments

### Três cartões, e as perguntas abertas fechadas

Dupla A, Dupla B e O confronto. O cartão de confronto diz quantas vezes as duas
duplas se enfrentaram e quem levou mais — e, como isso quase sempre é "primeira
vez", traz junto os cruzamentos jogador × jogador, que é onde há história.

- **Média de pontos** = pontos que a dupla faz × pontos que leva, por jogo.
- **Recorte** = histórico inteiro, não a janela de 4 noites: dupla quase não se
  repete, e a janela deixaria os cartões vazios.

Não precisou de view nova: `historicoDoConfronto` (`core/rules/matchup-stats.ts`)
deriva tudo das partidas e campeonatos que o app já sabe ler.

### 0 × 0 deixou de ser erro

`error()` devolve nulo para `zero`, e quem segura o SALVAR é `salvavel`. As
outras três mensagens (empate, vai a dois, passou do limite) continuam.
