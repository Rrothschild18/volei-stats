# 22: Todo mundo joga

**What to build:** O jogo deixa de depender do dono estar com o celular na mão. Qualquer jogador do vôlei marca presença, tira sorteio, troca duplas, cria campeonato, lança e corrige placar, e decide o que a quadra decide. O dono continua sendo o único a mexer em quem existe e no que desaparece. Uma correção de placar mostra quem corrigiu.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `adminGuard` sai de presença, sorteio, criar campeonato e decisões de quadra
- [x] Um guard de jogador no lugar: quem ainda não reivindicou nome não escreve
- [x] Cadastrar/editar/inativar jogador, link de convite, apagar e renomear seguem só do dono
- [x] A partida corrigida mostra "corrigido por <nome>"
- [x] O formulário de jogador para de exibir a data de nascimento
- [x] As telas não mostram mais "ADMIN" como papel; o dono aparece como dono

## Comentários

Feito. O `adminGuard` deu lugar a dois guards, porque as duas perguntas que ele
misturava são diferentes: `playerGuard` (já disse quem é → faz o jogo) e
`ownerGuard` (criou o vôlei → cadastra e apaga). No front, `CurrentGroupStore`
passou a expor `canPlay()` e `isOwner()` em vez de `isAdmin()`.

**Decisão que o ticket não previa:** as telas de Início e de Classificação
tinham **duas caras** escolhidas pelo papel — admin via o jogo em quadra e os
atalhos, jogador via "SEU JOGO". Com todo mundo organizando, o papel não serve
mais para essa escolha; o que ela sempre quis dizer é **"estou nesta partida?"**.
Agora é `myBracket()` que decide o título, o herói e a ordem das duplas, e a
Classificação mostra "SEU RESULTADO" para quem jogou aquele campeonato e o bloco
de campeões para quem não jogou. Ficou mais certo que antes: um admin que
jogasse a final via a tela de organizador, não a dele.

Modelo alinhado com o schema: `Group.ownerPlayerId` e `GroupRole` reduzido a
`player | viewer`. Saiu `setGroupRole` (com a trava do último admin) e entrou
`transferOwnership`. O interruptor de "Administrador" no formulário de jogador
foi removido — promover admin não existe mais, e passar o vôlei é um ato só, na
tela do vôlei (ticket 20).

**O estado `viewer` não tem representação no mock**, de propósito: no schema um
espectador tem `player_id` nulo, e a identidade mockada *é* um `playerId`, então
não há como assumir um espectador sem a sessão anônima. `canPlay()` já é o
portão correto e passa a valer de verdade quando o ticket 20 trouxer o fluxo de
reivindicar o nome. Meia-modelagem aqui só geraria um caso que ninguém testa.

Verificado no browser com as duas identidades: Caio (jogador) abre presença,
sorteio e corrige placar, e é redirecionado ao tentar `/jogadores/novo`; Rafa
(dono) vê o selo DONO, cadastra, e o formulário não exibe data de nascimento
nem interruptor de admin. A correção roda ponta a ponta e a partida passa a
mostrar "Corrigido por Caio". 76 testes, lint e build limpos, **0 violações AXE**
em 11 telas.
