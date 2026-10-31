# 12: Decisões de quadra · par-ou-ímpar e desempate (§9.3)

**What to build:** As duas decisões que só acontecem na quadra passam a existir no app. No encaixe, o admin registra quem venceu o par-ou-ímpar. Quando duas duplas empatam na diferença exatamente na fronteira que decide, o app para de inventar um critério: ele pausa a chave e pede o par-ou-ímpar entre elas. Enquanto isso, o jogador vê a chave pausada.

**Blocked by:** 09, 11

**Status:** done

- [ ] Sheet do encaixe com as duas duplas, a explicação do que está em jogo, os dois botões de 76px e o rodapé de chave pausada
- [ ] A leitura da rodada 1 devolve `needsTiebreak { kind: 'losers' | 'winners', teamIds }` quando há empate de diferença na fronteira, e nenhuma partida é gerada
- [ ] Sheet de desempate com a tabela das duplas empatadas, o texto de que o app não decide sozinho e os dois botões com os nomes
- [ ] A decisão é persistida com quem decidiu e o horário, e serve de critério secundário na ordenação
- [ ] Vale para perdedores empatados e para vencedores empatados
- [ ] Nenhum dos dois sheets fecha por Esc ou por toque no fundo
- [ ] Só admin decide; para jogador a tela mostra "CHAVE PAUSADA" com quem está no par-ou-ímpar
- [ ] O JSDoc quebrado de `OddPlayerPlacement` fica legível
- [ ] Teste: empate na fronteira devolve `needsTiebreak` e não gera partida; empate fora da fronteira segue normal

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Estado `needsTiebreak` pausando a chave, os dois sheets de decisão (encaixe e desempate) e a decisão persistida com quem decidiu.
