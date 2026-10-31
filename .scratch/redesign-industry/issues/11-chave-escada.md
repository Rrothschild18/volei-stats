# 11: Ao vivo · Chave e seu caminho (1l/1m)

**What to build:** A chave do campeonato aparece como escada: a rodada 1 que decide quem sobe, o encaixe quando houve, e os degraus até o campeão, cada partida com o seu estado. O jogador vê a mesma escada do ponto de vista dele, com a própria vaga destacada e as fases futuras como "se vencer".

**Blocked by:** 09

**Status:** done

- [ ] `app-ladder` com trilho de nós, caixa de partida por degrau, pílula de estado (AGORA / A SEGUIR / DEPOIS / SE VENCER) e `crown` + CAMPEÃO no último nó
- [ ] A escada se gera a partir das fases do formato, não de um caso fixo
- [ ] Rodada 1 com as duas caixas lado a lado e o desfecho em texto
- [ ] Card do encaixe quando existe, dizendo quem venceu o par-ou-ímpar, quem era o avulso e quem ficou fora
- [ ] Rodapé com quem está fora e por quê
- [ ] Vaga indefinida aparece como "VENCEDOR"; a dupla do usuário ganha fundo `accent-100`
- [ ] No `knockout-4`, as duas semifinais aparecem lado a lado e depois a final e o 3º lugar
- [ ] Visão do jogador sem nenhuma ação de admin, com a nota de com quem ele está e quantas vitórias faltam

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. `app-ladder` derivada de `plannedPhases(format)`, com os degraus futuros como "VENCEDOR" e a visão do jogador.
