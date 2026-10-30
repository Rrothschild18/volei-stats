# Plano: migrar o VoleiStats para Supabase

## 1. A pergunta do login, respondida

### "Dá para fazer login com nome e aniversário?"

Dá — mas **isso não é login, é identificação**, e no Supabase sai mais caro do
que parece. Três problemas:

1. **A chave do app é pública.** Num site estático no GitHub Pages, a `anon key`
   está no bundle, visível para qualquer um. Se o cliente precisa ler a data de
   nascimento para comparar, então **qualquer pessoa consegue baixar a lista
   inteira de nomes e aniversários**.
2. **Para fazer direito, precisa de código de servidor.** Daria para esconder os
   aniversários atrás de uma Edge Function que valida e emite um token. Isso
   significa escrever e manter código servidor + lidar com assinatura de JWT —
   justamente o que você queria evitar com "extremamente leve".
3. **A segurança seria teatro de qualquer jeito.** Num grupo de amigos, todo
   mundo sabe o aniversário de todo mundo.

**Veredito: não recomendo.** Se o nível de segurança desejado é "nome +
aniversário", existe um caminho nativo que entrega o mesmo com zero trabalho —
ver Nível 1 abaixo.

### "E OTP ou magic link?"

Nativo no Supabase e ótimo — **com uma pegadinha séria que precisa ser dita**:

> O servidor de e-mail embutido do Supabase envia **2 e-mails por hora no
> projeto inteiro**, e **só entrega para membros da sua organização no
> Supabase**. Ou seja: sem configurar SMTP próprio, magic link e OTP
> simplesmente **não funcionam para os seus amigos**.

A solução é ligar um SMTP próprio (Resend tem plano grátis de 3.000 e-mails/mês).
São ~20 minutos de configuração, uma vez. Depois o limite padrão passa a ser 30
novos usuários por hora, ajustável no painel.

Entre os dois, **OTP de 6 dígitos ganha do magic link**: o usuário digita o
código na própria tela, sem sair do app e sem depender de URL de redirecionamento
configurada no Supabase — o que no GitHub Pages é uma fonte extra de dor.

---

## 2. A ideia que resolve tudo: jogador ≠ usuário

Os ~20 jogadores de vôlei **não precisam de conta**. Eles são *registros* numa
tabela. Quem precisa de conta é quem **escreve** dados: cria sessão, sorteia,
registra placar. Isso é 1 a 3 pessoas.

Separando "quem lê" de "quem escreve", o login deixa de ser um problema:

| Nível | Quem | Como entra | Pode |
| --- | --- | --- | --- |
| **0 — Público** | qualquer um com o link | **sem login** | ver rankings, histórico, campeonatos |
| **1 — Jogador** *(opcional)* | os jogadores | **1 toque**, anônimo + "quem sou eu" | ver "minhas estatísticas", confirmar presença |
| **2 — Organizador** | você (e quem mais quiser) | **OTP de 6 dígitos** por e-mail | tudo: criar sessão, sortear, lançar placar |

**Nível 0** cobre ~90% do uso e tem fricção zero: abre o link, vê tudo.

**Nível 1** usa o *anonymous sign-in* nativo do Supabase: um toque gera uma
sessão real, o usuário escolhe seu nome numa lista e pronto. Sem e-mail, sem
senha, sem código. A "segurança" é a mesma de nome+aniversário — nenhuma — mas é
nativo, honesto e de graça. Só vale a pena se você quiser as telas pessoais; se
não, pule.

**Nível 2** é raro na prática: a sessão do Supabase se renova sozinha e dura
meses. Você digita um código uma vez e esquece.

> ⚠️ **Armadilha documentada:** usuários anônimos recebem o papel
> `authenticated`, **não** `anon`. Uma policy escrita como
> `for all to authenticated` liberaria escrita para qualquer anônimo. Por isso
> toda policy de escrita no `schema.sql` passa por `is_organizer()`.

---

## 3. O que o banco passa a garantir sozinho

Várias regras que hoje só existem na tela viram **constraints**:

| Regra | Hoje | Depois |
| --- | --- | --- |
| Vôlei não tem empate | validação na tela | `check (score_a <> score_b)` |
| Não existe 0 × 0 | validação na tela | `check (score_a + score_b > 0)` |
| Dupla não repete jogador | nada | `check (player1_id <> player2_id)` |
| Vencedor / perdedor / diferença | calculado à mão em cada lugar | **colunas geradas** — impossível ficarem erradas |
| Mesma partida lançada duas vezes | nada | `unique (tournament_id, phase, team_a_id, team_b_id)` |
| Duas duplas na mesma posição | nada | `unique (tournament_id, position)` |

E as **views `player_stats` / `team_stats`** substituem os laços do
`StatisticsService` por uma query só — o que de quebra corrige o defeito §7.6 da
auditoria (a contagem de esperas triplicada), porque a view conta apenas sorteios
`selected`.

O schema completo está em [`supabase/schema.sql`](../supabase/schema.sql).

---

## 4. Etapas

### Fase 0 — Você faz (≈15 min)
1. Criar projeto em supabase.com (grátis). Guardar **Project URL** e **anon key**.
2. SQL Editor → colar `supabase/schema.sql` → Run.
3. Authentication → Providers → ligar **Email** com "Confirm email" desligado.
4. Criar sua conta e rodar:
   `insert into organizers (user_id) values ('<seu uuid de auth.users>');`
5. *(se quiser Nível 1)* Providers → ligar **Anonymous sign-ins**.
6. *(para OTP funcionar)* Settings → Auth → **Custom SMTP** com Resend.

### Fase 1 — Camada de dados (eu)
- `pnpm add @supabase/supabase-js`
- `SupabaseService` com o client; URL e anon key em `environment.ts`
  (**podem ser commitados — são públicos por design**, quem protege é a RLS).
- Repositórios Supabase atrás da **mesma interface** que o `AppFacade` já usa.
  O facade quase não muda: a arquitetura atual já está bem separada.
- Tipos gerados do schema (`supabase gen types typescript`) em vez de interfaces
  escritas à mão.
- Corrigir o N+1 (§7.12): `select('*, player:players(*)')` em vez de laço de
  `getPlayerById`.

### Fase 2 — Autenticação (eu)
- Rotas de leitura abertas; rotas de escrita atrás de um guard.
- Tela de OTP: e-mail → código de 6 dígitos → entra.
- *(opcional)* Tela "quem sou eu" com anonymous sign-in.

### Fase 3 — Migração dos dados (eu)
- A exportação para JSON já existe no app. Falta o importador:
  uma tela que lê o JSON exportado e insere no Supabase na ordem certa
  (jogadores → sessões → sorteios → campeonatos → partidas).
- Depois disso o IndexedDB vira cache, não fonte de verdade.

### Fase 4 — Deploy (eu)
- O workflow do GitHub Pages já existe e continua funcionando.
- **Keepalive:** projetos grátis são pausados após ~7 dias sem acesso. Se vocês
  jogam toda semana isso fica no limite. Resolvo com um cron no GitHub Actions
  que faz um `select` trivial a cada 3 dias.

### Fase 5 — Offline *(opcional, decidir)*
Praia costuma ter sinal ruim, e é exatamente na praia que o placar é lançado.
Duas opções honestas:

- **Online-only** (simples): se cair o sinal, não dá para lançar placar.
- **Offline-first** (mais trabalho): IndexedDB continua sendo a base local e uma
  fila sincroniza com o Supabase quando a conexão volta. É a opção certa para o
  uso real, mas é a parte mais cara do projeto.

---

## 5. Limites do plano grátis

| Item | Limite | Suficiente? |
| --- | --- | --- |
| Banco | 500 MB | Folgadíssimo — esse app gera kilobytes por ano |
| Usuários ativos/mês | 50.000 | Sim |
| Tráfego | 5 GB/mês | Sim |
| Projetos ativos | 2 por organização | Sim |
| **Pausa por inatividade** | **~7 dias sem acesso** | **Precisa do keepalive** |
| E-mails (SMTP embutido) | **2/hora, só para sua org** | **Não — precisa de SMTP próprio** |
| Backup para download | não tem | Mantemos o export em JSON |

---

## 6. Decisões pendentes

1. **Login do organizador:** OTP por e-mail (precisa configurar Resend) ou
   anonymous + lista de organizadores (zero setup, zero segurança)?
2. **Leitura pública** mesmo — qualquer um com o link vê tudo — ou tudo atrás de
   login?
3. **Nível 1 (jogador identificado)** entra agora ou fica para depois?
4. **Offline-first** entra no escopo ou começamos online-only?
5. **Guardar data de nascimento** dos jogadores? (só vale se for usar para algo —
   aniversariante do mês, por exemplo)
