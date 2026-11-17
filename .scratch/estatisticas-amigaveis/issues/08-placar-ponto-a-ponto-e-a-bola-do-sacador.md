# 08: Placar ponto a ponto e a bola do sacador

**What to build:** Um modo de marcar **ponto a ponto**, com um ícone de bola
mostrando **quem está sacando** — porque na quadra todo mundo esquece de quem
era o saque. Hoje o app só aceita o **placar final**, e por isso não tem como
saber.

**Blocked by:** 07

**Status:** ready-for-agent

## Por que não dá hoje

A tela é `PLACAR FINAL`: o jogo acontece, alguém abre a folha e põe o resultado
nos steppers (`score-sheet.component.ts` — `scoreA`/`scoreB` com
`app-stepper`). Não existe registro nenhum da **ordem** dos pontos, e sem a
ordem não há como dizer de quem é o saque.

Derivar "do placar" não funciona: 12 × 10 pode ter sido qualquer uma de
milhares de sequências, e cada uma deixa o saque num lugar diferente.

## A regra do grupo (é ela que o ícone segue)

- A dupla que **ganha o rali** passa a sacar (posse de bola).
- Dentro da dupla, **o mesmo jogador continua sacando** enquanto a dupla segue
  fazendo pontos.
- Quando a dupla **perde a posse e depois a recupera**, saca **o outro** da
  dupla.

Com isso, o sacador atual é **determinístico** a partir de três coisas: quem
abriu sacando (ticket 07), qual dos dois jogadores daquela dupla abriu, e a
sequência de ralis. É isso que o ícone desenha, e é isso que permite
**prever o sacador conforme o placar anda**.

## O armazenamento

Um log de ralis. A forma mais barata que mantém a consistência:

```sql
alter table matches
  add column first_server_player_id uuid,   -- qual dos dois abriu sacando
  add column rally_log smallint[];           -- 0 = dupla A ganhou o rali, 1 = dupla B
```

E uma constraint ligando log e placar — sem ela os dois divergem na primeira
correção:

```sql
check (
  rally_log is null or (
    cardinality(array_positions(rally_log, 0)) = score_a and
    cardinality(array_positions(rally_log, 1)) = score_b
  )
)
```

`rally_log` anulável de propósito: quem lançar o placar final continua lançando,
e as partidas antigas seguem válidas. Com log nulo, o ícone simplesmente não
aparece.

Alternativa considerada: tabela `match_rallies` (uma linha por ponto). Mais
normalizada, 12 a 22 linhas por partida, e perde a atomicidade que a constraint
acima dá de graça. Só vale se o grupo quiser marcar hora de cada rali.

## Os dois modos convivem

A folha de placar ganha duas portas: **"MARCAR PONTO A PONTO"** e **"LANÇAR
PLACAR FINAL"**. Quem marca ponto a ponto desiste no meio? O que já foi marcado
vira o placar final, e o log fica do tamanho que deu.

Corrigir placar de uma partida com log é o caso difícil: mexer no número sem
mexer no log quebra a constraint. O caminho honesto é a correção **apagar o
log** (o placar vale, o detalhe não) e dizer isso na tela.

## O que mais isso destrava (bônus, não escopo)

- **Duração real** da partida, em vez da estimativa do ticket 02
- **Maior virada** — hoje impossível, porque não há parciais
- Pontos por rali, sequência de pontos, o 12 × 10 que foi 10 × 2 antes

- [ ] Modo ponto a ponto, com os dois modos convivendo
- [ ] Ícone de bola no sacador, seguindo a regra do grupo
- [ ] Sacador derivado de (quem abriu, qual jogador, log) — com teste de unidade
      cobrindo virada de posse e troca dentro da dupla
- [ ] `rally_log` + constraint de consistência com o placar
- [ ] Correção de placar apaga o log, e a tela avisa
- [ ] Abandonar no meio salva o que foi marcado
- [ ] Partida sem log não mostra ícone nenhum

## Pergunta aberta

A regra de alternância dentro da dupla ("quando recupera a posse, saca o
outro") precisa de um OK do grupo antes de virar código — é a única parte que o
app vai afirmar sozinho em quadra.
