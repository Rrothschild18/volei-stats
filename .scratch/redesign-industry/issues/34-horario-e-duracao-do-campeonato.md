# 34: Que horas começou cada campeonato, e quanto durou

**What to build:** Na sessão do dia e no histórico, cada campeonato mostra a que horas começou e quanto durou. É o que responde "deu tempo de fazer três?" na hora de decidir se cabe mais um, e "a noite rendeu?" no dia seguinte.

**Blocked by:** None (can start immediately). Ver a nota sobre o ticket 33 abaixo.

**Status:** done

## Os dois carimbos já existem

Nada de schema novo. O banco já guarda os dois instantes:

| Marca    | De onde sai                                                                            |
| -------- | -------------------------------------------------------------------------------------- |
| Começou  | `tournaments.created_at` — o campeonato nasce quando a proposta de sorteio é escolhida |
| Terminou | `played_at` da partida de fase `final`                                                 |

E `formatTime()` já existe para escrever `20:08`.

## Duas escolhas que o ticket precisa assumir

**O começo é a criação, não a primeira partida.** São minutos de diferença — escolher o formato, caminhar até a quadra — e a criação é o único instante que existe mesmo para um campeonato que ainda não teve jogo. Se na prática a diferença incomodar, a alternativa é o `played_at` da primeira partida; o que não serve é misturar os dois critérios entre telas.

**O fim é o preenchimento da final, e isso é estável.** Corrigir um placar depois não mexe no `played_at` — o gatilho só escreve `corrected_at` —, então a duração não muda retroativamente quando alguém conserta um número.

## Os estados que não têm duração

- **Em andamento:** mostrar a hora de início e há quanto tempo está rolando, não um traço.
- **Começou e nunca acabou** (a noite terminou antes da final): dizer que não terminou, em vez de inventar um número ou mostrar uma duração que cresce para sempre.

## Nota sobre o ticket 33

Hoje a fila oferece a final **antes** da disputa de 3º, então "até a final" exclui o último jogo que realmente aconteceu — a duração sai curta. Com o ticket 33 a final volta a ser o último jogo, e aí "até a final" e "até o fim" passam a ser a mesma coisa. Este ticket pode ser feito antes; só é preciso saber que o número fica certo de verdade depois do 33.

- [x] A sessão do dia mostra, por campeonato, a hora de início e a duração
- [x] O histórico de dias anteriores mostra o mesmo
- [x] A classificação de um campeonato encerrado traz início e duração
- [x] Campeonato em andamento mostra o início e há quanto tempo está rolando
- [x] Campeonato que nunca teve final diz isso, e não mostra duração
- [x] A duração não muda quando um placar é corrigido depois
- [x] O cenário de demonstração tem horários plausíveis, para a metade sem banco poder testar isto
