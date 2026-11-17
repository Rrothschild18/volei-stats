# 07: Par-ou-ímpar, lado da quadra e saque inicial

**What to build:** Antes do placar, o app registra o **início do jogo**: quem
ganhou o par-ou-ímpar, o que escolheu, de que lado cada dupla começou e quem
abriu sacando. É um passo **pulável** — quem só quer lançar o resultado continua
lançando.

**Blocked by:** None (can start immediately)

**Status:** done (migration ainda não aplicada na nuvem)

## Por que juntas

São o mesmo momento em quadra: o par-ou-ímpar decide, e o que ele decide **é**
saque ou lado. Separar daria duas telas para a mesma pergunta e duas migrations
para a mesma linha.

## A migration

Tudo anulável — as 32 partidas já lançadas do Vôlei Unaerp continuam válidas, e
quem pular o passo também:

```sql
alter table matches
  add column coin_winner_team_id  uuid,
  add column coin_caller_player_id uuid,
  add column coin_choice          text check (coin_choice in ('saque','lado')),
  add column team_a_side          text check (team_a_side in ('esquerda','direita')),
  add column first_server_team_id uuid;
```

Com as chaves compostas que o schema usa em toda parte
(`foreign key (coin_winner_team_id, group_id) references tournament_teams(id, group_id)`),
senão dá para apontar para dupla de outro vôlei.

`team_a_side` guarda **um** lado: o da dupla A. O da dupla B é o outro — duas
colunas poderiam discordar entre si.

**RLS e `grant`**: as colunas novas entram no `grant update` de `matches`? Quem
lança placar é qualquer jogador, e quem **corrige** também — o início do jogo
deve seguir a mesma regra, inclusive o registro de quem mexeu. Conferir o
`grant` coluna a coluna antes de assumir que funciona.

## A tela

Um passo antes dos steppers, em `score-sheet.component.ts`, com **PULAR** bem
visível. Três toques no caminho feliz:

1. quem ganhou o par-ou-ímpar (as duas duplas, mais "quem chamou")
2. escolheu **saque** ou **lado**
3. lado da dupla A: **esquerda** ou **direita**

Quem abriu sacando sai das respostas 1 e 2 quando a escolha foi saque; quando
foi lado, é a outra dupla que saca, e o app já sabe.

## O que isso destrava

- **Mão quente do par-ou-ímpar** — quem mais ganha a disputa inicial
- **O lado que mais venceu hoje** — sol e vento aparecem nos números
- **Abrir sacando ajuda?** — a pergunta que o grupo vai querer ver respondida
- É o pré-requisito do ticket 08: sem saber **quem abriu sacando**, a bola do
  sacador não tem de onde partir

## Cuidados

- Partida antiga sem esses dados não pode virar "0% de par-ou-ímpar ganho" para
  ninguém: estatística só conta partida que tem o registro, e diz sobre quantas.
- O passo não pode atrasar o placar. Pulado, nunca mais pergunta naquela
  partida — e aparece como "não registrado", não como erro.
- O par-ou-ímpar de **desempate de campeonato** (`tiebreak_decisions`) é outra
  coisa, de outro momento. Não misturar as duas contagens.

- [ ] Migration aplicada na nuvem — **falta `supabase db push --linked`**
- [x] `grant`/RLS conferidos: as políticas de `matches` são de tabela, não de
      coluna, então as colunas novas já entram no insert/update do jogador
- [x] Início do jogo no alto da folha de placar, sem travar nada
- [x] Saque inicial derivado da escolha (`quemAbreSacando`), com teste
- [ ] Estatísticas novas (mão quente, lado que mais venceu, abrir sacando
      ajuda?) — **ficam para quando houver dado**: nenhuma partida tem registro
      ainda, e um gráfico de zero partidas não diz nada
- [x] Teste SQL das constraints (`supabase/tests/10-inicio-do-jogo.sql`)
- [x] e2e: o placar salva sem registro; saque/lado derivam certo; o registrado
      aparece no placar travado

## Comments

### Virou bloco opcional, não passo com PULAR

O ticket pedia "um passo antes dos steppers, com PULAR bem visível". Ficou um
**bloco no alto da própria folha**, marcado como `opcional`, com os steppers
logo abaixo. O motivo é o cuidado que o próprio ticket escreveu: *o passo não
pode atrasar o placar*. Não responder já é pular — e um passo que precisa ser
dispensado custa um toque a mais para quem só quer lançar o resultado no meio
do jogo. O `aria-live` do bloco diz "Ninguém precisa registrar isso para lançar
o placar".

### O sacador é derivado, e o banco guarda isso

`quemAbreSacando()` deriva o sacador da escolha do par-ou-ímpar (saque → quem
ganhou; lado → a outra dupla). A coluna existe, mas uma constraint impede
gravar sacador que contradiz a escolha: sem ela o app teria duas verdades sobre
o mesmo momento, e a que estivesse errada só apareceria meses depois, numa
estatística.

### Quem chamou é por pessoa, não por dupla

A pergunta "quem chamou?" aparece depois de escolher a dupla vencedora, com os
dois jogadores dela. Sem isso, "mão quente do par-ou-ímpar" seria uma
estatística de duplas sorteadas — ou seja, de ninguém.

### O lado é UMA coluna

`team_a_side` guarda o lado da primeira dupla; o da outra é o oposto. Duas
colunas poderiam discordar entre si, e nada no banco impediria.

### Correção de placar não mexe no início

`correct_match_score` só reescreve placar. O par-ou-ímpar e o lado continuam os
que foram registrados — corrigir número não desfaz o que aconteceu em quadra.
