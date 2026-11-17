# 02: Resumo esportivo da sessão

**What to build:** Um resumo da noite, em forma de cartão, que **muda a cada
campeonato concluído** e serve de base para a imagem de parabéns do ticket 03.

**Blocked by:** None (can start immediately)

**Status:** done

## O conteúdo, nesta ordem

1. **Maior sequência de vitórias da sessão** — da noite, não histórica
2. **Jogos disputados na sessão**
3. **Títulos e pódios** (de `tournament_standings`)
4. **Mais vitórias**
5. **Quem fechou a quadra** — os jogadores da última partida da sessão
6. **Partida mais apertada** — nos dados reais: Eli+Be 12×10 Pati+Raul
7. **Média de duração das partidas** — hoje estimável pelo intervalo entre
   `played_at`; os campeonatos do grupo levam de 21 a 31 min para 4 partidas
8. **Campeão do campeonato**, com o placar da final

## De onde cada um sai

```
1  player_match_results (tem session_id e played_at) ordenado no tempo
2  idem, count por jogador na sessão
3  tournament_standings  — 40 linhas já gravadas, hoje ninguém lê
4  player_match_results filtrado pela sessão
5  a partida de maior played_at da sessão
6  min(point_difference) entre as partidas da sessão
7  diferença entre o primeiro e o último played_at do campeonato ÷ partidas
8  tournament_standings position = 1 + o match de phase='final'
```

Sequência (item 1) **não existe hoje** em nenhuma view nem no
`StatisticsService` — precisa de leitura ordenada por `played_at`. Em SQL sai
com função de janela; no cliente, varrendo `player_match_results` já ordenado.

## Cuidados

- **A duração é estimada.** `played_at` é quando o placar foi *lançado*, não
  quando a partida começou — e o intervalo entre dois lançamentos inclui a
  conversa, a água e a troca de quadra. O rótulo precisa ser honesto
  ("≈ 25 min por partida"). O número exato só vem com o ticket 08.
- **Campeonato em andamento não entra** nos itens 3 e 8: `tournament_standings`
  só existe para `status = 'completed'`.
- **Campeonato excluído** sai do resumo junto (já é o comportamento da cascata).
- Com uma partida só na sessão, os itens 6 e 7 não têm graça: esconda o cartão
  em vez de mostrar "média de 1 partida".

- [x] Os 8 itens, calculados por sessão
- [x] Recalcula quando um campeonato é concluído
- [x] Duração rotulada como estimativa
- [x] Cartões sem dado suficiente não aparecem
- [x] Teste de unidade da sequência da sessão (empate, uma partida, zero)
- [x] e2e: os destaques aparecem na sessão de hoje do demo

## Comments

### Onde mora

`core/rules/session-summary.ts` (regra pura, com teste) +
`features/group/tournaments/session-summary.component.ts`, que vira a seção
**04 · RESUMO DA NOITE** na tela da sessão, depois dos campeonatos do dia. A
tela não precisou carregar nada novo: o `SessionStore` já tinha campeonatos,
partidas e jogadores.

### Empate não é desfeito

Quem empata aparece junto ("BIA E RAFA"). Desempatar por um critério inventado
seria escolher um vencedor que a quadra não escolheu — e numa tela cuja função
é parabenizar, isso é o contrário do objetivo. (A pergunta aberta do spec
continua aberta: se o dono quiser desempate, é trocar `lideres()`.)

### A duração é estimativa, e a tela diz isso

`played_at` é quando o placar foi **lançado**, não quando a partida começou, e o
intervalo entre dois lançamentos inclui conversa, água e troca de quadra. Só
conta intervalo dentro do mesmo campeonato — entre campeonatos o buraco é o
sorteio seguinte. No cenário do demo dá ≈ 9 min por partida. O número exato só
vem com o ticket 08.

### Campeonato em andamento não entra

`finalStandings` só existe em campeonato concluído: o que está rolando não tem
campeão, e anunciar um seria anunciar o que ainda pode mudar. O resumo inteiro
some quando a noite ainda não tem partida lançada.

### Os três extras que eu havia sugerido ficaram fora

Pontos marcados na noite, dupla invicta e "primeira vitória de X" — o dono
cortou. A regra não os calcula.

## Perguntas abertas

- **"Quem fechou a quadra"**: os 4 jogadores da última partida, ou só a dupla
  que venceu?
- **Empate** em "mais vitórias" e "maior sequência": dois nomes ou desempate?
