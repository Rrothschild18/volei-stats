# 02: Componentes de moldura e layout

**What to build:** Os blocos de montagem de toda tela do redesign, prontos para reuso: a moldura blueprint com as marcas de canto, a faixa de título de seção, o bloco escuro de destaque, o rodapé fixo de ação, a grade de números e a lista numerada. Uma rota de exemplo mostra cada um nos seus estados.

**Blocked by:** 01

**Status:** done

- [ ] `app-blueprint` desenha os 4 cantos de 11px e aceita conteúdo projetado; variante selecionada troca a borda para o acento
- [ ] `app-section-band` com kicker numerado à esquerda e meta ou link à direita
- [ ] `app-hero-field` (bloco `accent-900`) com kicker, marca de "ao vivo", nomes de dupla, tags e botão invertido
- [ ] `app-action-bar` com um ou dois botões (grid `1fr 1.6fr`), respeitando o estado desabilitado
- [ ] `app-stat-grid` com 3 ou 4 células, número condensado com `tnum` e rótulo
- [ ] `app-spec-list` com nº, rótulo, valor, número à direita e nota de rodapé opcional
- [ ] `app-gender-badge` nas variantes M e F
- [ ] Alvos de toque ≥ 44×44 nos elementos interativos e AXE limpo na rota de exemplo

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Em `src/app/shared/ui/`: blueprint, section-band, hero-field, action-bar, stat-grid, spec-list e gender-badge.
