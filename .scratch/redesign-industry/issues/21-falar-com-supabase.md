# 21: Falar com o Supabase, e "Seus vôleis" de verdade

**What to build:** A primeira tela do app lendo o banco. Abrir o app cria uma sessão anônima no navegador, e os vôleis listados vêm do Postgres, cada um com o papel real de quem está olhando. É a primeira fatia completa: do banco ao pixel.

**Blocked by:** 20

**Status:** done

- [x] Cliente do Supabase configurado por ambiente, com a URL e a chave publicável
- [x] Sessão anônima criada na primeira visita e reaproveitada nas seguintes
- [x] Tipos do banco gerados, e as leituras tipadas por eles
- [x] Repositórios contra o banco atrás da mesma fachada que as telas já usam
- [x] Uma escolha de origem de dados: banco ou dados de exemplo em memória
- [x] "Seus vôleis" e o papel em cada um vindos das views, com uma consulta por tela e não uma por jogador
- [x] Quem é dono aparece como dono sem nenhum papel vindo de stub local
