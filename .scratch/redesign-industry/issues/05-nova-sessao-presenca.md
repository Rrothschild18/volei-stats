# 05: Nova sessão · presença (1e)

**What to build:** O admin abre a sessão do dia marcando quem apareceu. Enquanto ele marca, o bloco de presença responde: conta os presentes, desenha as vagas de dupla (e a do avulso quando o número é ímpar) e diz quais campeonatos dá para montar com aquela gente. Abaixo de 4 pessoas não dá para abrir.

**Blocked by:** 02, 03, 04

**Status:** done

- [ ] Busca de jogador por nome, com a lista de ativos e os inativos recolhidos
- [ ] Linha de jogador com checkbox quadrado 24px, nome, tag ADMIN e selo de gênero; não marcado em `neutral-700`
- [ ] Hero de presença reativo: contagem, "N duplas / + 1 avulso" e grade de vagas D1…DN/AVULSO
- [ ] Chips dos escolhidos com selo de gênero
- [ ] Linha de formatos possíveis a partir de `formatsForPlayerCount(n)`, incluindo as variantes com o avulso fora
- [ ] Sem formato para o número marcado, a linha vira o aviso de que as saídas aparecem na próxima etapa
- [ ] "ABRIR SESSÃO · N" desabilitado abaixo de `MIN_SUPPORTED_PLAYERS`
- [ ] A tela também serve para editar a presença de uma sessão já aberta

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Presença reativa com vagas, chips e a linha de formatos de `formatsForPlayerCount`. Com sessão já aberta hoje, a tela edita a presença dela.
