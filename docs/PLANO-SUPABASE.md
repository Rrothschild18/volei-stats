# Plano: migrar o VoleiStats para Supabase

## 1. Acesso: grupo, link e convite — sem e-mail, sem senha

### O modelo

O app passa a ter **grupos**. Um grupo tem um administrador e a mesma estrutura
que existe hoje: jogadores, sessões, sorteios, campeonatos e partidas.

Tudo gira em torno de **dois links**:

| Link | Quem usa | O que acontece |
| --- | --- | --- |
| **Link do grupo**<br>`/g/{uuid}` | qualquer um | entra como espectador e passa a ver rankings, histórico e campeonatos |
| **Link de convite**<br>`/convite/{uuid}` | quem o admin convida | digita o nome e vira **jogador** daquele grupo |

Não existe e-mail, senha, OTP nem magic link. **O link é a credencial.**

### Como isso funciona por baixo

Na primeira visita, o app cria uma **sessão anônima do Supabase**
(`signInAnonymously()`) e a guarda no navegador. É o "cookie de longa vida":
sobrevive a fechar o navegador e se renova sozinha enquanto a pessoa usar o site.

A partir daí:

- abrir o **link do grupo** chama `enter_group(uuid)` → vira espectador;
- abrir o **link de convite** chama `redeem_invite(token, nome, sexo)` → vira jogador.

Essas são as **duas únicas portas de entrada**. Todo o resto do acesso é
decidido pela associação gravada no banco, não pela URL — então **ninguém
descobre um grupo chutando uuid**, e nenhuma listagem vaza para fora.

> Os convites são **reutilizáveis de propósito**: a mesma pessoa abre no celular
> e no tablet, e cada aparelho ganha sua própria sessão ligada ao mesmo jogador.

### Perdeu o acesso?

Exatamente como você descreveu: o administrador gera **um novo convite apontando
para o jogador existente**. A pessoa abre, e volta com o histórico intacto —
nenhuma estatística se perde, porque o jogador é um registro, não uma conta.

### ⚠️ O preço de não ter senha — precisa decidir

Se **o administrador** limpar os dados do navegador, trocar de celular ou perder
o aparelho, **não há e-mail para recuperar a conta**. O grupo fica sem quem
escreva.

Por isso `create_group()` já devolve um **link de recuperação de administrador**.
Três coisas precisam ser verdade, e quero seu aval:

1. O app mostra esse link na criação do grupo com um aviso claro de **guardar**
   (anotar, mandar para si mesmo no WhatsApp, favoritar).
2. O link continua acessível nas configurações do grupo, para copiar de novo.
3. **Dá para ter mais de um administrador** — é a melhor proteção. Recomendo
   nomear um segundo desde o início.

Sem senha, essa é a troca honesta: ganha-se fricção zero, perde-se a
recuperação automática.

### Por que não OTP / magic link (e por que é uma boa notícia)

Eu ia recomendar OTP, mas o seu modelo é melhor para este caso — e de quebra
**some um problema sério**:

> O servidor de e-mail embutido do Supabase manda só **2 e-mails por hora no
> projeto inteiro**, e **só entrega para membros da sua organização no
> Supabase**. OTP e magic link exigiriam configurar um SMTP próprio (Resend)
> antes de funcionarem para os seus amigos.

Com link + convite, **nada disso é necessário**. Zero configuração de e-mail,
zero custo, zero dependência externa.

---

## 2. O que o banco passa a garantir sozinho

Várias regras que hoje só existem na tela viram **constraints**:

| Regra | Hoje | Depois |
| --- | --- | --- |
| Vôlei não tem empate | validação na tela | `check (score_a <> score_b)` |
| Não existe 0 × 0 | validação na tela | `check (score_a + score_b > 0)` |
| Dupla não repete jogador | nada | `check (player1_id <> player2_id)` |
| Vencedor / perdedor / diferença | calculado à mão em cada lugar | **colunas geradas** |
| Mesma partida lançada duas vezes | nada | `unique (tournament_id, phase, team_a, team_b)` |
| **Dados de dois grupos se misturarem** | — | **chaves compostas com `group_id`** |

As views **`player_stats` / `team_stats`** substituem os laços do
`StatisticsService` por uma query só — e de quebra corrigem o defeito §7.6 da
auditoria (esperas contadas em triplo), porque contam apenas sorteios
`selected`.

Schema completo em [`supabase/schema.sql`](../supabase/schema.sql).

---

## 3. Etapas

### Fase 0 — Você faz (≈10 min)
1. Criar projeto em supabase.com (grátis). Guardar **Project URL** e **anon key**.
2. SQL Editor → colar `supabase/schema.sql` → Run.
3. Authentication → Providers → ligar **Anonymous sign-ins**.
4. *(recomendado)* Attack Protection → ligar **Captcha (Turnstile)**.
   O endpoint anônimo é aberto; sem captcha, alguém pode inflar a tabela de
   usuários. É a única proteção que esse modelo pede.

### Fase 1 — Camada de dados (eu)
- `pnpm add @supabase/supabase-js`
- `SupabaseService` com o client; URL e anon key em `environment.ts`
  (**podem ser commitados — são públicos por design**; quem protege é a RLS).
- Repositórios Supabase atrás da **mesma interface** que o `AppFacade` já usa —
  a arquitetura atual já está bem separada, o facade quase não muda.
- Tipos gerados do schema (`supabase gen types typescript`).
- Corrigir o N+1 (§7.12): `select('*, player:players(*)')` no lugar dos laços
  de `getPlayerById`.

### Fase 2 — Grupos, links e convites (eu)
- Sessão anônima automática na primeira visita.
- Telas: criar grupo, entrar por link, resgatar convite (nome + sexo).
- Painel do admin: gerar convite de entrada, gerar convite de re-associação,
  revogar convite, promover a administrador.
- Guards: leitura exige ser membro; escrita exige ser admin.

### Fase 3 — Migração dos dados (eu)
- A exportação para JSON já existe. Falta o importador: lê o JSON e insere na
  ordem certa (jogadores → sessões → sorteios → campeonatos → partidas),
  tudo dentro de um grupo novo.

### Fase 4 — Deploy (eu)
- O workflow do GitHub Pages já existe e continua funcionando.
- **Keepalive:** projetos grátis são pausados após ~7 dias sem acesso. Resolvo
  com um cron no GitHub Actions fazendo um `select` trivial a cada 3 dias.

### Fase 5 — Offline *(decidir)*
Praia tem sinal ruim, e é lá que o placar é lançado. Honestamente:
- **Online-only**: simples; sem sinal, não dá para lançar placar.
- **Offline-first**: IndexedDB continua sendo a base local e uma fila sincroniza
  quando a conexão volta. É o certo para o uso real e a parte mais cara.

---

## 4. Limites do plano grátis

| Item | Limite | Suficiente? |
| --- | --- | --- |
| Banco | 500 MB | Folgadíssimo |
| Usuários ativos/mês | 50.000 | Sim |
| Tráfego | 5 GB/mês | Sim |
| Projetos ativos | 2 por organização | Sim |
| **Pausa por inatividade** | **~7 dias sem acesso** | **Precisa do keepalive** |
| E-mails | — | **Não usamos mais** |

---

## 5. Decisões

✅ **Resolvidas**
- Acesso por link de grupo + convite, sem e-mail/senha.
- Leitura liberada por uuid do grupo; escrita só para administrador.
- Estrutura multi-grupo, cada grupo igual ao app de hoje.

❓ **Em aberto**
1. **Recuperação do administrador** (§1): confirma a abordagem do link de
   recuperação + segundo administrador?
2. **Offline-first** entra no escopo ou começamos online-only?
3. **Um grupo por link ou a pessoa pode estar em vários?** O schema já suporta
   vários; falta decidir se a interface mostra um seletor.
