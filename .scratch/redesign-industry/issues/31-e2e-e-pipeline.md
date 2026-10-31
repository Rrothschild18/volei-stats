# 31: Testes de ponta a ponta, e a pipeline que os roda

**What to build:** Dois caminhos do app verificados por máquina, contra o banco de verdade: criar um vôlei e alguém entrar nele pelo código, e um campeonato do zero até o fim. E uma pipeline que roda isso, mais o que já existe, em todo push — hoje ela só publica.

**Blocked by:** 30

**Status:** done

- [x] Playwright como dependência do projeto, com o navegador que ele próprio baixa
- [x] Cada teste cria o próprio vôlei e apaga o que criou: nenhum depende do cenário de exemplo nem da ordem
- [x] Fluxo de entrar: criar vôlei, recusa de datas iguais, cadastro, convite, e outro navegador entrando pelo código e dizendo quem é
- [x] Fluxo de campeonato: presença, sorteio, campeonato, placar, correção assinada e campeonato finalizado
- [x] Sem rede: a mensagem aparece e o que foi digitado fica
- [x] `pnpm test:e2e` sobe o que precisa e roda sozinho
- [x] Pipeline em todo push e PR: lint, testes de unidade, suíte SQL, build e e2e
