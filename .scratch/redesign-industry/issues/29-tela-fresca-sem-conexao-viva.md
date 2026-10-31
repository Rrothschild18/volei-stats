# 29: A tela se mantém fresca sem conexão viva

**What to build:** Sem conexão permanente e sem custo de Realtime, a tela ainda parece viva: ela relê quando você volta para o app, depois de cada coisa que você escreve, e quando você puxa para atualizar. E quando a rede cai, ela diz isso sem jogar fora o que você digitou.

**Blocked by:** 26, 27, 28

**Status:** ready-for-agent

- [ ] Relê ao voltar para o primeiro plano
- [ ] Relê depois de cada escrita sua
- [ ] Puxar para atualizar em todas as telas de lista
- [ ] Sem rede: "sem conexão · tentar de novo", com o que foi digitado preservado
- [ ] Nada de fila de escrita offline: o que falhou, falhou, e a pessoa tenta de novo
