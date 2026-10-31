# 19: Papéis reais por grupo e Seus vôleis (1b)

**What to build:** A pessoa entra e vê todos os vôleis de que participa, com o papel que tem em cada um, e escolhe por onde entrar. O papel deixa de ser um stub local: vem de `group_members`, vale por grupo, e as ações de admin simplesmente não existem na tela de quem é jogador.

**Blocked by:** 18

**Status:** ready-for-agent

- [ ] Tela "Seus vôleis" com um card por grupo do usuário, sem barra de abas
- [ ] Grupo com sessão ao vivo hoje aparece como hero, com o próximo jogo do usuário e a grade de números
- [ ] Demais grupos em moldura, com a próxima sessão e a grade de números
- [ ] Notas explicando que o papel vale por grupo e como entrar em outro vôlei
- [ ] Com um grupo só, a tela é pulada e a troca segue disponível no header
- [ ] `GroupsStore` com o resumo de cada grupo; `CurrentGroupStore` lendo `group_members`
- [ ] Entrada por convite e recuperação por nome + data de nascimento
- [ ] `memberGuard`/`adminGuard` passam a decidir pelo papel real
- [ ] Nenhuma ação de admin renderiza para jogador (não basta desabilitar)
