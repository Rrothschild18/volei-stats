# 09: Ao vivo · Fila (§7.5)

**What to build:** A tela de campeonato ao vivo mostra o que está em quadra agora, o que vem depois e o que já acabou, com a consequência de cada resultado dita em palavras ("+5 · direto à final", "−2 · par-ou-ímpar") e quem lançou cada placar. E ler a fila deixa de mudar o estado do campeonato.

**Blocked by:** 08

**Status:** done

- [ ] Header interno com o nome do campeonato, o menu de `ellipsis-vertical` e o segmented FILA · CHAVE · DUPLAS
- [ ] Hero da partida de agora, com a fase, as duas duplas, as tags de origem e "LANÇAR PLACAR"
- [ ] Seção "A SEGUIR" com as partidas pendentes e as vagas ainda indefinidas como "vencedor"
- [ ] Seção "CONCLUÍDOS", cada resultado numa moldura com a rodada, o horário, quem lançou, o vencedor com a consequência em tag de acento e o perdedor em neutro
- [ ] Link "Corrigir" só renderiza para admin
- [ ] Evento de par-ou-ímpar mostrado como nota tracejada, com quem decidiu e o horário
- [ ] Aba Duplas lista as duplas com o estado de cada uma: em jogo, eliminada direto, desfeita no encaixe, encaixe
- [ ] `getNextMatches` não marca mais eliminação direta nem grava prioridade
- [ ] A eliminação direta e a prioridade passam a ser marcadas quando a rodada 1 fecha, no caminho de salvar placar
- [ ] Teste: chamar a leitura da fila duas vezes não altera o campeonato

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Fila com consequências em palavras; `getNextMatches` não marca mais eliminação direta — isso foi para `closeRound1`, no caminho de salvar.
