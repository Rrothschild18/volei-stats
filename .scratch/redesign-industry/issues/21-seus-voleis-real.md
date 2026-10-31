# 21: Seus vôleis com dados reais

**What to build:** Entrar no app mostra os vôleis de que você participa, cada um com o papel que você tem nele, vindos do banco — e a tela se mantém atualizada sem conexão viva: ela relê quando volta pro primeiro plano, depois de cada escrita sua, e quando você puxa pra atualizar.

**Blocked by:** 20

**Status:** ready-for-agent

- [ ] `GroupsStore` e `CurrentGroupStore` leem `my_groups` e `group_members`
- [ ] Vôlei com sessão ao vivo hoje vira hero, com o seu próximo jogo
- [ ] Com um vôlei só, a tela é pulada; a troca segue no header
- [ ] `memberGuard` decide pelo papel real; nenhum papel vem de stub local
- [ ] Relê ao ganhar o primeiro plano (`visibilitychange`), depois de toda escrita, e no puxar-pra-atualizar
- [ ] Sem conexão, a tela diz "sem conexão · tentar de novo" e não perde o que foi digitado
