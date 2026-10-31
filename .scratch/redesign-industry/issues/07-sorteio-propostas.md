# 07: Sorteio · propostas distintas e troca (§9.7)

**What to build:** O admin sorteia e recebe três propostas que são de fato diferentes — cada uma com um avulso diferente. A tela mostra as prioridades herdadas do campeonato anterior, as duplas na ordem da chave e deixa trocar dois jogadores por toque. A pontuação interna continua ordenando as propostas, mas não aparece em nenhum lugar.

**Blocked by:** 06

**Status:** done

- [ ] Seção de prioridades com ícone por motivo, nome e o motivo em texto, mais a nota de que entram na rodada 1 e não esperam
- [ ] Três propostas A/B/C, cada uma com o nome de quem espera; a selecionada em acento
- [ ] Uma proposta por avulso distinto, com as 100 tentativas rodadas por avulso e a melhor mantida
- [ ] Propostas deduplicadas por chave canônica (pares ordenados + avulso); com número par, só pelos pares
- [ ] Menos de 3 propostas distintas → mostra menos, sem repetir
- [ ] Lista de duplas com nº, dois chips trocáveis, nota de prioridade e a tag da vaga (JOGO 1/JOGO 2/BYE)
- [ ] Trocar: toque num chip seleciona e mostra a barra de dica; toque em outro permuta; toque no mesmo ou no `x` cancela
- [ ] Aviso textual de dupla repetida, recalculado depois de cada troca, dizendo quais propostas evitam a dupla
- [ ] Nenhum número de pontuação renderizado
- [ ] `waiting-draw` removido do enum de motivos e da UI
- [ ] Teste: as propostas geradas têm avulsos diferentes e nenhuma chave canônica repetida

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Uma proposta por avulso distinto, dedupe por chave canônica, troca por toque e aviso de dupla repetida. Nenhuma pontuação em tela.
