# 04: Shell de grupo e navegação nova

**What to build:** O app passa a viver dentro de um grupo: as telas ficam sob `/g/:groupId` com as quatro abas na barra inferior, cada tela ganha o header de raiz ou interno com a tag de papel, e as rotas soltas antigas redirecionam para os lugares novos. O menu lateral com hambúrguer sai.

**Blocked by:** 01

**Status:** done

- [ ] Rotas `/g/:groupId/{inicio,campeonatos,rankings,jogadores}` com lazy loading
- [ ] `app-tab-bar` com 4 abas, aba ativa em `accent-100` com `aria-current="page"` e respeito ao safe-area
- [ ] `app-screen-header` nas variantes raiz (troca de grupo + tag de papel + título 38px) e interna (voltar 44×44 + kicker + título + ação à direita)
- [ ] `CurrentGroupStore` com `groupId`, `role`, `playerId`, nomes dos admins e o `computed` `isAdmin`
- [ ] `memberGuard` e `adminGuard` protegendo as rotas do grupo e as de admin
- [ ] `/sessoes`, `/sorteios` e `/historico` redirecionam para as rotas novas
- [ ] `ShellComponent` com `mat-sidenav`/`mat-toolbar` removido do caminho de navegação
- [ ] Largura fluida no celular e coluna centralizada de `max-width: 480px` no desktop

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Rotas `/g/:groupId` com as 4 abas, `CurrentGroupStore`, `memberGuard`/`adminGuard` e as rotas antigas redirecionando. O `ShellComponent` saiu.
