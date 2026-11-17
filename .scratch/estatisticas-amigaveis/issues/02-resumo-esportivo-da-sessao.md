# 02: Resumo esportivo da sessão

**What to build:** Um resumo da noite, em forma de cartão, que **muda a cada
campeonato concluído** e serve de base para a imagem de parabéns do ticket 03.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

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

- [ ] Os 8 itens, calculados por sessão
- [ ] Recalcula quando um campeonato é concluído
- [ ] Duração rotulada como estimativa
- [ ] Cartões sem dado suficiente não aparecem
- [ ] Teste de unidade da sequência da sessão (empate, uma partida, zero)

## Perguntas abertas

- **"Quem fechou a quadra"**: os 4 jogadores da última partida, ou só a dupla
  que venceu?
- **Empate** em "mais vitórias" e "maior sequência": dois nomes ou desempate?
