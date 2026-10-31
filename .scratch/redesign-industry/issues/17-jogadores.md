# 17: Jogadores · lista, edição e perfil (1x/1y/1z)

**What to build:** A aba Jogadores lista quem existe no grupo com o aproveitamento de cada um, filtrando por ativos, inativos ou todos. O admin cadastra e edita: nome, data de nascimento, sexo, ativo e administrador — com trava quando é o último admin. Qualquer um abre o próprio perfil e vê os números, os parceiros frequentes e as últimas partidas.

**Blocked by:** 02, 03, 04

**Status:** done

- [ ] Busca e segmented de filtro Ativos · Inativos · Todos com as contagens
- [ ] Linha de 56px com avatar quadrado de inicial, nome, selo de gênero, tag ADMIN e "N J · N%"
- [ ] "NOVO JOGADOR" só para admin; jogador vê a lista sem a barra de ação
- [ ] Formulário com nome, data de nascimento (obrigatória, explicando que recupera o acesso), sexo em segmented com a nota de que só afeta o sorteio
- [ ] Switch de ativo e switch de administrador, com a explicação do que cada um faz
- [ ] O switch de administrador fica bloqueado com explicação quando é o último admin do grupo
- [ ] Grade de estatísticas do jogador no formulário
- [ ] Perfil com a grade de 6 números, parceiros frequentes com % e últimas partidas com V/D
- [ ] Tocar em si mesmo abre o próprio perfil; em outro jogador, o perfil só leitura

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Lista com filtro, formulário em Signal Forms com data de nascimento, trava do último admin e perfil com parceiros e últimas partidas.
