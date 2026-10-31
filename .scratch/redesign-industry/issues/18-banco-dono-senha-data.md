# 18: Banco · dono, senha-data e acesso (expand)

**What to build:** O banco passa a descrever o modelo de acesso que a gente decidiu: um vôlei tem **um dono** (que pode passá-lo pra frente), todo mundo mais é jogador, e a data de nascimento é uma **senha trocável** — o dono cadastra todos com uma data inicial comum e cada pessoa troca pela dela ao entrar. Escrita de jogo libera pra qualquer jogador; cadastro e exclusão ficam com o dono.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `group_role` passa a ser `owner` / `player` / `viewer`; exatamente um `owner` por vôlei
- [x] `transfer_ownership(group_id, player_id)` move a propriedade num toque; o gatilho impede o vôlei ficar sem dono
- [x] `groups.initial_birth_date` guarda a data inicial sugerida; `players.birth_date` vira not null
- [x] `players.birth_date_changed` marca quem já trocou a senha-data
- [x] `claim_player()` exige a nova data na mesma chamada e grava `birth_date_changed`
- [x] `reset_player_birth_date(player_id)` devolve a data inicial, só pro dono, sem nunca expor a atual
- [x] `birth_date` fora de todo `select` que o cliente faz (nenhuma política devolve a coluna)
- [x] `redeem_invite()` perde o braço que criava jogador com nome e sexo digitados
- [x] RLS: ler = ser membro; escrever = ser jogador em sessões, sorteios, campeonatos, partidas e decisões; só dono em `players`, `invites`, `groups` e em todo `delete`
- [x] `tournaments.format_id` not null, tabela `tiebreak_decisions`, `decided_by`/`decided_at` em `odd_player_placements`, `reported_by`/`corrected_by`/`corrected_at` em `matches`
- [x] View `my_groups` com nome, papel, sessão de hoje e nº de jogadores por `user_id`
- [x] Os testes SQL existentes cobrem o modelo novo, incluindo o que jogador **não** pode

## Comentários

Feito. O schema foi reescrito e roda limpo no Postgres 17 do Supabase atual.

**Decisão de desenho:** a propriedade virou a coluna `groups.owner_player_id`,
não um valor no papel. Isso dá "exatamente um dono" por construção, torna a
transferência um `update`, dispensa o gatilho do último admin — e faz a
propriedade acompanhar o jogador, então reivindicar o próprio nome num aparelho
novo devolve o vôlei. Não existe mais link de recuperação, porque não é preciso.

**Dois achados durante os testes:**

1. `revoke select (birth_date)` **não tem efeito** enquanto o papel tem `select`
   na tabela inteira, e o Supabase concede isso por padrão. O jeito certo é
   revogar a tabela e conceder coluna a coluna; o PostgREST respeita, e
   `select=*` passa a devolver só o permitido. O shim dos testes passou a usar
   `alter default privileges` pra imitar produção, senão o teste concedia tudo
   de volta depois do schema e a senha vazava sem ninguém notar.
2. `unclaimed_players` como view estava **errada**: a subquery de
   `group_members` roda sob a RLS de quem pergunta, e um espectador só vê a
   própria linha — então o dono (e qualquer um já dentro) aparecia como "nome
   por reivindicar". Virou função `security definer` que exige ser membro.

O `run.sh` passou a funcionar com Docker quando a máquina não tem binários de
servidor do Postgres (foi o caso aqui), usando a mesma imagem do `supabase
start`. A espera por readiness é por conexão de verdade: `pg_isready` responde
"pronto" durante a inicialização e o servidor reinicia depois, derrubando a
conexão.

76 verificações passando (45 asserções de acesso, 12 de regra, 19 recusas
esperadas).

## Revisão: nove brechas, todas fechadas

A revisão de código achou **nove furos reais** no modelo de acesso, cada um
reproduzido num Postgres descartável antes de ser fechado. Agora cada um tem o
teste que faltava, em `supabase/tests/03-brechas.sql`.

**A crítica foi minha, e recém-introduzida:** `enter_group` declarava
`returns groups`, e **privilégio de coluna não se aplica aos campos de um
composto devolvido por função `security definer`**. O `revoke select` que eu
tinha acabado de consertar era contornado pelo valor de retorno: qualquer um que
abrisse o link recebia `initial_birth_date` em texto puro — a senha combinada do
grupo. O retorno virou só id e nome.

**A segunda derrubou o conceito de dois links.** `enter_group` era chamável pelo
cliente com o uuid do vôlei, que é permanente — então revogar um convite nunca
trancava ninguém, e o próprio retorno da função entregava o uuid. A função virou
interna (`revoke execute ... from public`, porque revogar de `authenticated`
sozinho não tira o grant implícito), e a única porta é `redeem_invite()`. O
plano foi atualizado: **existe um link, e é o do convite**.

As outras sete:

| | Era |
| --- | --- |
| `my_groups` com subquery escalar em `sessions` | dois jogadores abrindo a presença ao mesmo tempo criavam duas sessões do dia, e a **primeira tela do app** passava a dar erro 21000 para todos os membros — só o dono podendo apagar a linha sobrando. Agora `unique (group_id, date)` |
| `transfer_ownership` para nome não reivindicado | o vôlei ficava sem dono efetivo, e quem reivindicasse aquele nome com a data inicial assumia tudo |
| `claim_player` sem `and active` | inativar não revogava nada: quem saiu seguia escrevendo. Agora um gatilho derruba os aparelhos na inativação, e nome inativo não entra |
| `create_group` sem comparar as datas | dono reusando o próprio aniversário como data do grupo tornava o nome dele reivindicável com a senha que ele mesmo manda |
| `UPDATE` da senha não revogado | o dono trocava a data de alguém na mão, por fora do reset — a vítima ficava logada sem saber |
| trava de força bruta por `auth.uid()` | sessão anônima nova é grátis (é a porta do modelo) e zerava o contador: ~150 palpites/hora em vez de 5/15min. Agora conta por **nome tentado** |
| `reported_by`/`corrected_by` como colunas comuns | qualquer jogador mudava o placar deixando a assinatura nula — e a justificativa de liberar a correção para todos caía junto. Agora um gatilho assina |

Mais duas de configuração: `enable_anonymous_sign_ins` estava `false` no
`config.toml` (a sessão anônima **é** o modelo de acesso; o app não passaria da
primeira tela localmente), e o plano prometia um `seed.sql` que é do ticket 19 —
texto corrigido.

**O que eu aprendi e vale repetir:** dos nove, três eram a mesma armadilha do
Postgres em roupas diferentes — privilégio concedido num nível mais amplo
engolindo a restrição mais estreita (`select` de tabela vs coluna, `update` de
tabela vs coluna, `execute` de PUBLIC vs papel). Vale desconfiar de todo
`revoke` que eu escrever.
