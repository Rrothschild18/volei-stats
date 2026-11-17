# 07: Par-ou-ímpar, lado da quadra e saque inicial

**What to build:** Antes do placar, o app registra o **início do jogo**: quem
ganhou o par-ou-ímpar, o que escolheu, de que lado cada dupla começou e quem
abriu sacando. É um passo **pulável** — quem só quer lançar o resultado continua
lançando.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

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

- [ ] Migration aplicada com `supabase db push --linked` (`--dry-run` antes)
- [ ] `grant`/RLS conferidos para as colunas novas
- [ ] Passo de início de jogo, pulável, antes dos steppers
- [ ] Saque inicial derivado da escolha quando possível
- [ ] Estatísticas novas contam só partidas com registro, e dizem quantas
- [ ] Teste SQL das constraints e do caminho do jogador que corrige
