# 14: Campeonatos por dia (1d)

**What to build:** A aba Campeonatos mostra o dia de hoje — a sessão e os campeonatos que já rolaram, cada um no seu estado — e, abaixo, os dias anteriores com o resumo de cada um. Para o admin, a barra de ação leva ao próximo passo certo: abrir a sessão, ou sortear se ela já existe.

**Blocked by:** 06, 13

**Status:** done

- [ ] Faixa "HOJE" com a contagem de presentes e as linhas de sessão e de cada campeonato
- [ ] Linha de campeonato ao vivo mostra a fase atual; a de finalizado mostra os campeões com `crown`
- [ ] Faixa "ANTERIORES" com data, presentes, nº de campeonatos e o último vencedor
- [ ] Barra de ação só para admin, alternando entre "NOVA SESSÃO" e "NOVO SORTEIO" conforme já exista sessão hoje
- [ ] Cada linha navega para a tela correspondente

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Hoje e anteriores, com a barra do admin alternando entre nova sessão e novo sorteio.
