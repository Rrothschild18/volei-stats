# 16: Rankings · Individual, Duplas e Partidas (§7.6)

**What to build:** A aba Rankings reúne o que antes estava espalhado: o ranking individual, o de duplas e o histórico de partidas, em três abas internas. As tabelas cabem na largura do celular sem rolagem lateral. E as contagens param de inflar: esperas e total de sorteios passam a contar só a proposta escolhida.

**Blocked by:** 02, 03, 04

**Status:** done

- [ ] Segmented INDIVIDUAL · DUPLAS · PARTIDAS na tela raiz de Rankings
- [ ] Tabela individual Nº · Jogador · J · V · % · Esp, sem rolagem lateral, com a linha do usuário destacada
- [ ] Rodapé explicando a ordem, o que é "Esp" e que só aparece quem já jogou
- [ ] Tabela de duplas com o mesmo desenho, só com duplas de 3+ jogos juntos
- [ ] Partidas com filtro de período (Hoje · 7 dias · 30 dias · Tudo) e filtro por jogador
- [ ] Partidas agrupadas por campeonato, cada uma com horário, fase, as duas duplas e o placar, vencedor em peso maior
- [ ] "Vezes que esperou" e total de sorteios contam só os sorteios `selected`
- [ ] As rotas antigas de histórico e de rankings redirecionam para as abas novas

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Três abas de ranking, filtros de período e jogador, e as contagens só dos sorteios escolhidos.
