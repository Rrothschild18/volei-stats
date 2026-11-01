# Plano: migrar o VoleiStats para Supabase

## 1. Acesso: dono, código, senha do grupo e a data como chave pessoal

### O modelo

Qualquer pessoa cria um **vôlei** e é **dona** dele. O dono cadastra os amigos
— só nome e sexo — escolhe uma **senha simples para o grupo** ("volei99") e
manda **o código e a senha** no grupo do WhatsApp. Quem recebe toca no próprio
nome, digita a senha do grupo e **a data de nascimento dele**. Daquele momento
em diante aquele navegador _é_ aquela pessoa, com ranking, histórico, sessões e
campeonatos.

Não existe e-mail, OTP nem magic link. **O código e a senha do grupo são a
porta; a sua data é a sua chave** — é com ela que você entra num aparelho novo.

> A senha do grupo já foi uma data combinada. Trocou por texto porque uma data
> é ruim de ditar no telefone e fácil de confundir com a data de alguém — e a
> troca eliminou de uma vez a regra mais confusa do modelo antigo ("a sua data
> tem de ser diferente da inicial do grupo").

### Como isso funciona por baixo

Na primeira visita, o app cria uma **sessão anônima do Supabase**
(`signInAnonymously()`) e a guarda no navegador. É o "cookie de longa vida":
sobrevive a fechar o navegador e se renova sozinha enquanto a pessoa usar o
site.

A partir daí são três chamadas, e só:

| Chamada                | Quem usa                        | O que acontece                             |
| ---------------------- | ------------------------------- | ------------------------------------------ |
| `create_group(...)`    | quem quer um vôlei novo         | cria o vôlei, vira dono, recebe o link     |
| `redeem_invite(token)` | quem recebeu o link             | entra como **espectador**: lê, não escreve |
| `claim_player(...)`    | o espectador, na lista de nomes | diz quem é e vira **jogador**              |

> **Existe um link, e é o do convite.** O uuid do vôlei **não** é uma porta: a
> função que concede leitura é interna (`revoke execute ... from public`), e só
> `redeem_invite()` a chama. Se o uuid servisse de entrada, revogar um convite
> não trancaria ninguém — um uuid é permanente, e quem já entrou uma vez o tem
> para sempre. Por isso `redeem_invite()` também devolve só id e nome do vôlei:
> **privilégio de coluna não se aplica aos campos de um composto devolvido por
> função `security definer`**, então `returns groups` entregaria o hash da senha
> do grupo para qualquer um que abrisse o link.

> Os links são **reutilizáveis de propósito**: um link serve pro grupo todo, e a
> mesma pessoa abre no celular e no tablet, cada aparelho com sua própria sessão
> ligada ao mesmo jogador.

### A data de nascimento é uma senha, não um dado cadastral

É a mudança de postura que decidimos, e ela tem consequências que o schema
implementa:

|                                           | Como                                                                                                                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nunca sai do servidor**                 | `revoke select on players` + `grant select` coluna a coluna. Nem `select *` traz a data: o PostgREST devolve só as colunas permitidas. Só `claim_player()` a compara                              |
| **A senha do grupo abre um nome UMA vez** | `claim_player()` só aceita nome sem chave (`birth_date is null`). Depois que alguém entrou, a senha não abre mais aquele nome — senão quem tem o código assumiria quem já entrou                  |
| **A data pessoal é obrigatória**          | `claim_player()` recusa (`birth_date_required`) sem ela: é ela que vira a chave da pessoa                                                                                                         |
| **Guardada como hash**                    | A senha do grupo nunca é lida de volta — quem a sabe é o dono, que a escolheu. `crypt`/`gen_salt` do pgcrypto                                                                                     |
| **Só funciona com o link do vôlei**       | `claim_player()` exige ser membro; o uuid do vôlei é um segundo fator                                                                                                                             |
| **Trava de força bruta**                  | 5 erros em 15 minutos e para, contados **por nome tentado** e não só por sessão: uma sessão anônima nova é grátis (é a porta do modelo) e zerava o contador                                       |
| **Não revela quem está no vôlei**         | Nome inexistente, nome já reivindicado e senha errada devolvem exatamente a mesma resposta                                                                                                        |
| **Esqueceu?**                             | O dono chama `reset_player_access()`: o nome volta pra lista de quem ainda não entrou e os aparelhos ligados a ele são desligados. O dono **nunca vê** qual era a data                            |
| **Nem troca na mão**                      | `revoke update` em `players`, com `grant` só de nome, sexo e ativo: sem isso o dono apagaria a chave de alguém com um `update` comum, por fora do reset — e a vítima continuaria logada sem saber |
| **O dono não usa a senha do grupo**       | Ele entra com a data dele no momento em que cria o vôlei, então o nome dele nunca aparece na lista de nomes por reivindicar                                                                       |
| **Trocar a senha do grupo**               | `set_join_password()`, do dono. É o caminho de "entrou gente que não devia"; quem já entrou continua dentro                                                                                       |

A lista de nomes da tela do convite mostra **só quem ainda não entrou**
(`unclaimed_players()`), o que fecha a janela em que a senha do grupo serviria
pra qualquer um se passar por qualquer um.

> ⚠️ **O risco que aceitamos conscientemente:** entre o cadastro e a primeira
> entrada, qualquer um com o link pode reivindicar o nome de outro, porque a
> senha é a mesma pra todos. É um vôlei entre amigos, a janela é curta, e fica
> registrado em `player_claim_attempts` pro dono ver.

### Dono, não administrador

Existe **exatamente um dono** por vôlei, e ele não é um papel: é a coluna
`groups.owner_player_id`. Isso traz três coisas de graça:

1. **Não dá pra ficar sem dono** — é uma coluna com `on delete restrict`, e um
   gatilho impede inativar quem é dono. Nada de "trava do último admin".
2. **Passar o vôlei é um `update`** — `transfer_ownership()`, um toque.
3. **A propriedade acompanha o jogador, não o navegador.** Perdeu o celular?
   Reivindique seu nome com a sua data num aparelho novo e o vôlei volta pra
   você. Não precisa de link de recuperação, e não existe link de recuperação.

`transfer_ownership()` só aceita **quem já entrou no vôlei**. Passar para um nome
que ninguém reivindicou deixaria o vôlei sem dono efetivo — e aí qualquer um com
o link reivindicaria aquele nome com a senha do grupo e assumiria tudo.

> Isso é uma consequência direta da data ser senha: quem souber a **sua** data
> assume o seu vôlei. Antes a data era um dado público e esse caminho era
> inaceitável; agora é uma senha que **você** escolheu, e o dono entra já com a
> dele (o nome do dono nunca aparece na lista de nomes por reivindicar).

### O jogo é de todos

O papel diz uma coisa só: **se a pessoa já disse quem é**.

|                                                  | espectador | jogador | dono |
| ------------------------------------------------ | ---------- | ------- | ---- |
| Ler ranking, histórico, campeonatos              | ✅         | ✅      | ✅   |
| Marcar presença, tirar sorteio, trocar duplas    | —          | ✅      | ✅   |
| Criar campeonato, lançar e corrigir placar       | —          | ✅      | ✅   |
| Par-ou-ímpar de desempate, encaixe do avulso     | —          | ✅      | ✅   |
| Cadastrar / editar / inativar jogador            | —          | —       | ✅   |
| Gerar e revogar o link, passar o vôlei, renomear | —          | —       | ✅   |
| Apagar sessão, sorteio, campeonato               | —          | —       | ✅   |

A razão de o jogo ser de todos é prática: **o dono pode estar jogando a final,
ou ter faltado**, e o sorteio não pode esperar ele. Quem estiver com o celular
na mão resolve. O dono fica com _quem existe_ e _o que desaparece_.

Uma correção de placar grava `corrected_by` / `corrected_at`, e a tela mostra
"corrigido por \<nome\>" — é o que torna aceitável deixar a correção na mão de
todos, já que ela muda quem foi eliminado direto e as prioridades do próximo
sorteio.

Quem essa assinatura aponta é **o banco que decide**, num gatilho: como coluna
comum, qualquer jogador mudaria o placar deixando `corrected_by` nulo, ou
apontando para outra pessoa, e a justificativa inteira cairia.

**Inativar alguém tira o acesso dele**: os aparelhos ligados àquele jogador
voltam a ser espectadores, e `claim_player()` não aceita nome inativo. Sem isso,
quem saiu do vôlei seguiria marcando presença e lançando placar, porque sabe a
própria data.

### Por que não OTP / magic link

> O servidor de e-mail embutido do Supabase manda só **2 e-mails por hora no
> projeto inteiro**, e **só entrega para membros da sua organização**. OTP e
> magic link exigiriam configurar um SMTP próprio antes de funcionarem para os
> seus amigos.

Com link + nome + data, **nada disso é necessário**. Zero configuração de
e-mail, zero custo, zero dependência externa.

---

## 2. O que o banco passa a garantir sozinho

Várias regras que hoje só existem na tela viram **constraints**:

| Regra                                  | Hoje                          | Depois                                          |
| -------------------------------------- | ----------------------------- | ----------------------------------------------- |
| Vôlei não tem empate                   | validação na tela             | `check (score_a <> score_b)`                    |
| Não existe 0 × 0                       | validação na tela             | `check (score_a + score_b > 0)`                 |
| Dupla não repete jogador               | nada                          | `check (player1_id <> player2_id)`              |
| Vencedor / perdedor / diferença        | calculado à mão em cada lugar | **colunas geradas**                             |
| Mesma partida lançada duas vezes       | nada                          | `unique (tournament_id, phase, team_a, team_b)` |
| **Duas sessões no mesmo dia**          | nada                          | `unique (group_id, date)`                       |
| Dois par-ou-ímpar do mesmo tipo        | nada                          | `primary key (tournament_id, kind)`             |
| **Dados de dois vôleis se misturarem** | —                             | **chaves compostas com `group_id`**             |

A trava do primeiro placar é esse `unique`: a segunda tentativa na mesma
partida não vira erro feio, devolve o placar que já está lá.

As views **`player_stats` / `team_stats`** substituem os laços do
`StatisticsService` por uma query só — e de quebra corrigem o defeito §7.6 da
auditoria (esperas contadas em triplo), porque contam apenas sorteios
`selected`. A view **`my_groups`** entrega a primeira tela do app numa
requisição.

Schema completo em [`supabase/migrations/`](../supabase/migrations/), que é a
única definição dele: o que o `supabase start` aplica é exatamente o que os
testes de [`supabase/tests/`](../supabase/tests/) verificam, num Postgres
descartável e sem conta no Supabase. O terceiro arquivo, `03-brechas.sql`,
existe por causa de uma revisão que achou nove furos reais neste modelo: cada
um tem ali o teste que faltava.

```bash
./supabase/tests/run.sh
```

---

## 3. Sem tempo real, e sem offline

Duas decisões que **reduzem** o escopo:

**Nada de conexão viva.** Ninguém fica olhando o celular durante o jogo, e o
que se lança é o placar final de umas cinco partidas por noite. Então a tela
relê quando **volta pro primeiro plano** (`visibilitychange`), depois de **toda
escrita sua**, e quando você **puxa pra atualizar**. Se um dia o ao vivo
incomodar, o Supabase já tem Realtime no stack e é uma linha em `matches` —
**SSE seria o caminho mais caro**, porque precisaria de uma edge function
mantendo conexão aberta.

**Online-only.** O IndexedDB era andaime de protótipo e sai inteiro. Sem sinal,
o botão diz "sem conexão · tentar de novo", mantém o que foi digitado e não
perde nada — sem fila, sem "vai sincronizar depois". O importante é **não
fingir que salvou**.

O cenário de exemplo sobrevive como **modo demonstração**: um jeito de abrir o app
sem rede e sem banco, pra demonstrar e pra testar.

---

## 4. Etapas

### Fase 0 — Desenvolvimento local (sem credencial nenhuma)

```bash
supabase start      # Postgres, Auth e Studio em Docker, com o schema aplicado
supabase db reset   # refaz o banco do zero e recarrega o cenário de exemplo
```

O `supabase/seed.sql` carrega dois vôleis para clicar: **Vôlei Segunda**
(código `SEGUNDA`, senha `segunda99`, oito jogadores, a sessão de hoje em andamento e a da semana
passada encerrada) e **Vôlei Teste** (código `TESTE-VOLEI`, senha `volei99`, vazio, com
Raul como dono). Em nenhum dos dois alguém está reivindicado — é com o código, a
senha do grupo e a sua data que você entra.

O `supabase/config.toml` já liga **Anonymous sign-ins**: a sessão anônima é o
modelo de acesso, e com ela desligada `signInAnonymously()` devolve 422 e o app
não passa da primeira tela nem localmente.

Studio em http://127.0.0.1:54323, API em http://127.0.0.1:54321. As chaves
locais são as fixas do Supabase, iguais em qualquer máquina — não são segredo.
O `supabase/seed.sql` — que o **ticket 19** escreve — vai subir o cenário do
redesign no `supabase db reset`, pra dar pra clicar no app contra back-end de
verdade. Até ele existir, o banco local sobe vazio.

### Fase 1 — Camada de dados (ticket 19)

- `pnpm add @supabase/supabase-js`
- `SupabaseService` com o client; URL e chave publicável em `environment.ts`
  (**podem ser commitadas — são públicas por design**; quem protege é a RLS).
- Repositórios Supabase atrás da **mesma interface** que o `AppFacade` já usa.
- Tipos gerados do schema (`supabase gen types typescript`).
- Corrigir o N+1: `select('*, player:players(*)')` no lugar dos laços.

### Fase 2 — Entrar num vôlei (ticket 20)

Criar vôlei, cadastrar os amigos, o link, a lista de nomes, a troca de data, o
"já entrei em outro aparelho", o reset pelo dono e a transferência.

### Fase 3 — Projeto na nuvem (você, ≈3 min)

1. Criar projeto em supabase.com (grátis). Guardar **Project URL** e a chave
   publicável.
2. SQL Editor → colar **cada** migration de `supabase/migrations/`, em ordem de
   nome → Run. O deploy não aplica schema; o README diz quais são e por quê.
3. Authentication → Providers → ligar **Anonymous sign-ins**.
4. _(recomendado)_ Attack Protection → ligar **Captcha (Turnstile)**.
   O endpoint anônimo é aberto; sem captcha, alguém pode inflar a tabela de
   usuários. É a única proteção que esse modelo pede.
5. No GitHub: **Settings → Secrets and variables → Actions → Variables** →
   `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`. Variáveis, não segredos — a
   chave publicável vai para o bundle que o Pages serve, então ela é pública por
   construção. O README detalha o porquê; a chave **secreta** não entra em lugar
   nenhum.

### Fase 4 — Deploy

- O workflow do GitHub Pages já existe e continua funcionando. Antes do build,
  `scripts/env-producao.mjs` escreve as credenciais em
  `environment.prod.ts` (versionado vazio); variável faltando derruba o deploy
  ali, em vez de publicar uma tela que não carrega nada.
- **Keepalive:** projetos grátis são pausados após ~7 dias sem acesso.
  `keepalive.yml` faz um `select` trivial a cada 3 dias.

### Fase 5 — Remover o IndexedDB (ticket 30)

Depois que os repositórios Supabase estiverem funcionando. Apagar antes
deixaria o app sem camada de dados nenhuma.

**Não há migração de dados**: o histórico que existe no IndexedDB é de teste e
foi descartado de propósito. O primeiro vôlei real nasce vazio.

---

## 5. Limites do plano grátis

| Item                      | Limite                 | Suficiente?              |
| ------------------------- | ---------------------- | ------------------------ |
| Banco                     | 500 MB                 | Folgadíssimo             |
| Usuários ativos/mês       | 50.000                 | Sim                      |
| Tráfego                   | 5 GB/mês               | Sim                      |
| Projetos ativos           | 2 por organização      | Sim                      |
| **Pausa por inatividade** | **~7 dias sem acesso** | **Precisa do keepalive** |
| E-mails                   | —                      | **Não usamos**           |

---

## 6. Decisões

✅ **Resolvidas**

- Acesso por link do vôlei, sem e-mail/senha/OTP. O link é a porta.
- **A data de nascimento é uma senha**, trocada obrigatoriamente na primeira
  entrada, invisível ao cliente, resetável pelo dono.
- **Dono, não administrador**: exatamente um, numa coluna, transferível, e a
  propriedade acompanha o jogador.
- **O jogo é de todos os jogadores**; o dono fica com cadastro e exclusão.
- **A lista de nomes** mostra só quem ainda não entrou.
- **Sem tempo real**: relê ao focar, após escrever e ao puxar. Sem SSE.
- **Online-only**, sem offline-first; o cenário de exemplo sobrevive como modo demonstração.
- **Sem migração de dados.**
- Estrutura multi-vôlei: a mesma pessoa participa de vários, e os jogadores de
  um não têm relação nenhuma com os de outro.
