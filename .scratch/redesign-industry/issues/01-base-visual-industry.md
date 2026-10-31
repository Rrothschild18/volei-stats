# 01: Base visual Industry ao lado do Material (expand)

**What to build:** O sistema visual Industry passa a existir no app sem quebrar nada do que já está no ar. Abrir uma rota de demonstração mostra os objetos do sistema — botões, tags, molduras blueprint, campos e diálogo — com as cores, as fontes e os filetes finais do handoff. As telas Material de hoje continuam funcionando como antes.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] O stylesheet do sistema Industry vive no repositório e é importado globalmente
- [ ] O bloco `@theme` do Tailwind usa os tokens Industry (`bg`, `surface`, `text`, `accent`, rampas `neutral`/`accent`, selo `female-*`, fontes, espaço, raio, sombra)
- [ ] Barlow e Barlow Condensed carregam; Plus Jakarta sai do caminho novo
- [ ] `lucide-angular` instalado, com stroke 1.5 como padrão de uso
- [ ] Uma rota de demonstração renderiza `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-ghost`, `.tag*`, `.blueprint` + cantos, `.input`, `.field` e `.dialog`
- [ ] As telas existentes continuam renderizando sem erro de build

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Tokens Industry no `@theme`, sistema em `src/styles.css`, Barlow carregada e `app-icon` com a geometria do Lucide (o pacote `lucide-angular` só suporta até o Angular 21).
