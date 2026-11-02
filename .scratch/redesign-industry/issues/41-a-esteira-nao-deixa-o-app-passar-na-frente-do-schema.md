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

- [ ] A esteira falha, antes de publicar, quando há migration local que a nuvem
      não tem
- [ ] A mensagem de falha diz **qual** migration falta e como aplicá-la
- [ ] O caminho escolhido para a credencial está escrito no README, com o porquê
- [ ] Um deploy sem migration pendente continua passando sem fricção nova
