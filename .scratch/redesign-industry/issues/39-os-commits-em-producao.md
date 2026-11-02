# 39: Os commits parados em produção

**What to build:** Há 14 commits na `main` local que nunca foram ao ar: o campo
de data que voltou a aceitar digitação, os loaders por elemento, a regra do
placar com vantagem de dois, a chave que destrava depois de uma correção, as
folhas de decisão refeitas, e a correção do sorteio que deixava o terceiro
prioritário fora do primeiro jogo. Produção ainda serve o build de 01/11 15:36.

Este ticket é o push na `main` e o deploy que ele dispara.

**Blocked by:** os dois segredos do ticket 41 (`SUPABASE_ACCESS_TOKEN` e
`SUPABASE_DB_PASSWORD`) criados no repositório. O schema da nuvem já foi
aplicado, mas o portão do deploy agora pergunta à nuvem antes de publicar —
e sem os segredos ele para o deploy de propósito.

**Status:** ready-for-agent

## Por que isto é um ticket e não um comando

Porque `deploy.yml` dispara no push da `main` e não há portão entre as duas
coisas. O push **é** o deploy. Se algo estiver fora de ordem, descobre-se com o
site no ar — e a ordem que importa (schema antes do app) é justamente a que
ninguém vê.

A ordem está certa agora, e é por isso que este ticket pode começar. O que falta
é olhar o resultado, não torcer por ele.

- [ ] `git push origin main` com a árvore limpa e os 14 commits
- [ ] O workflow `Deploy to GitHub Pages` termina verde
- [ ] O workflow `CI` termina verde (os 8 checks)
- [ ] https://rrothschild18.github.io/volei-stats/ carrega e fala com a nuvem —
      não a tela de erro de credencial
- [ ] A branch `revert-ci-base-href-fix` deixa de existir no remoto
      (`git push origin --delete revert-ci-base-href-fix`)
