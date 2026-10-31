# 13: Classificação final e seu resultado (1t/1u, §4.6, §7.9)

**What to build:** Terminado o campeonato, a tela mostra os campeões, a classificação com vitórias/derrotas e saldo, e quem entra com prioridade no próximo sorteio. A dupla original desfeita no encaixe deixa de aparecer duas vezes na tabela: ela vira uma nota de rodapé. O jogador vê a mesma tabela com a posição dele destacada.

**Blocked by:** 10

**Status:** done

- [ ] Moldura dos campeões com `crown`, vitórias, saldo e os nomes em 36px
- [ ] Tabela Nº · Dupla · V–D · Saldo, com as tags de encaixe e eliminação direta
- [ ] A dupla original do encaixe não ocupa posição; aparece só no rodapé explicando o que houve
- [ ] Seção de prioridade no próximo sorteio a partir das entradas do campeonato
- [ ] Excluir campeonato com diálogo de confirmação, dizendo que ele sai das prioridades e das estatísticas
- [ ] Compartilhar o resultado pelo WhatsApp com um resumo em texto
- [ ] Visão do jogador com a colocação dele em destaque e a nota de com quem jogou
- [ ] "Último campeonato" passa a ordenar os concluídos por `createdAt` explicitamente
- [ ] Teste: a classificação não repete a dupla desfeita no encaixe

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Classificação sem a dupla desfeita no encaixe (ela virou rodapé), exclusão com confirmação e compartilhamento no WhatsApp.
