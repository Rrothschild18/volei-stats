# 41: A esteira não deixa o app passar na frente do schema

**What to build:** Hoje a ordem "schema antes do app" vive num parágrafo do
README. O deploy dispara no push e não pergunta nada ao banco. Este ticket põe a
pergunta na esteira: antes de publicar, ela compara `supabase/migrations/` com o
que a nuvem já aplicou e **para** se faltar alguma.

**Blocked by:** 39 (os commits em produção) — o portão novo não deve estrear
atravessado no deploy que o está esperando.

**Status:** ready-for-agent

## O que mudou desde que isto virou ideia

O README dizia que migration nova "precisa ser aplicada à mão — SQL Editor →
colar → Run". Não precisa: `supabase db push --linked` aplica e
`supabase migration list --linked` compara arquivo a arquivo, mostrando a coluna
`remote` vazia para o que não subiu.

Isso encolhe o ticket. O portão não precisa de script próprio nem de consulta
inventada ao `supabase_migrations.schema_migrations` — é um comando do CLI e a
leitura da saída.

O que ele precisa é de **credencial para falar com a nuvem a partir da esteira**,
e é aí que mora a decisão: hoje o deploy só conhece `SUPABASE_URL` e a chave
publicável, que não dão acesso ao schema. Um `SUPABASE_ACCESS_TOKEN` (e a senha
do banco) seriam **segredos** de verdade, ao contrário de tudo que a esteira tem
hoje — e vale decidir conscientemente se o deploy passa a carregar um segredo
que pode mexer no schema de produção.

Se a resposta for não, a alternativa honesta é o portão **recusar o deploy
quando o diretório de migrations mudou desde o último deploy**, sem falar com a
nuvem: mais burro, sem segredo nenhum, e ainda assim pega o caso real.

## O caso real que isto pega

Este: duas migrations ficaram paradas enquanto o app que depende delas estava a
um `git push` de ir ao ar. Nada avisava. O que avisou foi alguém lembrar.

## A decisão, tomada

**Segredo na esteira, check de verdade.** `deploy.yml` ganhou um passo antes do
build que liga o projeto e roda `scripts/checar-migrations.mjs`; ele pergunta à
nuvem e para se faltar migration. Os dois segredos
(`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`) são os primeiros da esteira:
tudo o mais que ela conhece é público por construção, e estes leem e alteram o
schema de produção.

Falta de segredo **derruba** o passo, com a mensagem dizendo o que criar e onde.
Deixar passar calado seria pior do que o portão não existir — e é a mesma
escolha que `env-producao.mjs` já fazia com as variáveis.

- [x] A esteira falha, antes de publicar, quando há migration local que a nuvem
      não tem
- [x] A mensagem de falha diz **qual** migration falta e como aplicá-la
- [x] O caminho escolhido para a credencial está escrito no README, com o porquê
- [x] Um deploy sem migration pendente continua passando sem fricção nova
- [ ] Os dois segredos criados no repositório — **antes** do ticket 39, senão o
      push que ele pede falha no portão

## O que foi verificado, e como

Contra a nuvem de verdade, nos dois sentidos: com o schema em dia o script sai
0; com uma migration falsa no diretório ele sai 1 e nomeia a que falta.

A leitura da saída do CLI tem teste (`scripts/checar-migrations.spec.mjs`), com
JSON real colhido do projeto antes e depois do `db push` de 01/11 — é o contrato
com o CLI, e é lá que se descobre se a forma da saída mudar.

O que **não** tem teste, e está dito no próprio arquivo: a fiação. Se o
`supabase link` funciona na esteira, se o segredo está certo, se o CLI escreve no
stdout que o script lê — isso só aparece no primeiro deploy.
