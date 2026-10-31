# 03: Componentes de entrada e decisão

**What to build:** Os controles com que o organizador e o jogador operam o app: chips de jogador (estáticos e trocáveis), toggle quadrado, steppers de ponto, abas internas e filtros, as três notas inline e o bottom sheet de decisão com foco preso.

**Blocked by:** 01

**Status:** done

- [ ] `app-player-chip` estático (nome + selo de gênero) e trocável (selecionado = fundo/borda acento)
- [ ] `app-switch` 48×28 com `role="switch"` e `aria-checked`, operável por teclado
- [ ] `app-stepper` compacto (limite de pontos) e grande (placar, número 64px `tnum`), com mínimo configurável
- [ ] `app-segmented` nas variantes aba (`role="tablist"`/`tab`, estado ativo com inset) e filtro (selecionado em acento)
- [ ] Notas inline: positiva, erro de validação (borda tracejada, sem vermelho) e evento neutro
- [ ] `app-bottom-sheet` entra de baixo em 200ms `ease-out`, respeita `prefers-reduced-motion`, usa `role="dialog"`/`aria-modal`, prende o foco e sabe recusar fechar por Esc/fundo
- [ ] AXE limpo na rota de exemplo

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. player-chip, switch, stepper, segmented, inline-note e bottom-sheet, com a armadilha de foco extraída em `FocusTrapDirective`.
