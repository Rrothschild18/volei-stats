# 15: Início · admin e jogador (1a/1c)

**What to build:** A primeira tela do grupo responde "o que está acontecendo agora". O admin vê o jogo em quadra com atalhos para lançar placar, sortear, mexer na presença e ver os campeonatos, mais os destaques do grupo. O jogador vê o próprio jogo — em quadra, a seguir ou de espera —, o que acontece se ele vencer, e o dia dele.

**Blocked by:** 06, 10, 11

**Status:** done

- [ ] Header de raiz com a troca de grupo, a data e a tag de papel
- [ ] Admin: hero "AGORA EM QUADRA" com as duas duplas e os botões de lançar placar e ver a chave
- [ ] Admin: grade de 3 atalhos (novo sorteio, presença · N, campeonatos · N)
- [ ] Admin: destaques do grupo (mais vitórias, melhor aproveitamento, melhor dupla, mais esperou) com as notas de regra, e a grade de partidas/jogadores/sorteios
- [ ] Jogador: hero cujo kicker diz se ele está em quadra, joga a seguir ou está de espera, com o "· você" na dupla dele
- [ ] Jogador: "LANÇAR PLACAR" só quando ele está na partida e ela não tem placar, com a nota de que o primeiro placar trava
- [ ] Jogador: trilho "se vocês vencerem" com as próximas fases, o dia dele e o card da chave ao vivo
- [ ] Sem jogo ao vivo o hero sai; sem sessão hoje ele vira "SEM SESSÃO HOJE" com o primário de abrir sessão

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Início de admin e de jogador, com hero, atalhos, destaques do grupo e o trilho "se vocês vencerem".
