# 06: Sessão de hoje · revezamento de espera (§9.1)

**What to build:** A tela da sessão do dia mostra quem está presente, quem já esperou hoje e quais campeonatos já rolaram. E o sorteio passa a revezar a espera de verdade: ninguém espera duas vezes antes de todos esperarem uma, contando só o que aconteceu nesta sessão.

**Blocked by:** 05

**Status:** done

- [ ] Seção de presentes com chips e link para editar a presença
- [ ] Seção de revezamento de espera com quem esperou e por quê, mais a nota de quantos ainda não esperaram
- [ ] Seção de campeonatos do dia com o estado de cada um
- [ ] Barra de ação do admin com "PRESENÇA" e "NOVO SORTEIO"
- [ ] Nenhum link de sessão nem botão de compartilhar sessão em tela
- [ ] `selectWaitingPlayer` sorteia entre os presentes menos os prioritários, restrito aos de menor contagem de espera **nesta sessão**
- [ ] A contagem de espera soma só os sorteios `selected` e o avulso dos campeonatos da sessão; histórico global não entra
- [ ] O caminho morto de espera por histórico global sai do código
- [ ] Teste: com 11 presentes e 2 já tendo esperado, o próximo esperado sai sempre dos 9 restantes

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Tela da sessão e `selectWaitingPlayer` revezando pela contagem do dia (`countWaitsInSession`). O caminho morto por histórico global saiu.
