# 06: A home em três faixas

**What to build:** A home do vôlei passa a ter três faixas com propósitos
diferentes: o **mural** (acumula), **a noite passada** (reseta toda semana) e os
**recordes do grupo** (nunca resetam).

**Blocked by:** 04, 05

**Status:** ready-for-agent

## As faixas

| Faixa | Conteúdo | Recorte |
| --- | --- | --- |
| **Mural** | vitórias, maior sequência, pontos marcados, jogos, títulos e pódios, dupla do coração | janela de 4 noites (ticket 04) — **dupla do coração é all-time** |
| **A noite passada** | campeão da noite, partida mais apertada, jogos no fio (≤2 pontos), fominha, quem fechou a quadra | a última sessão |
| **Recordes do grupo** | maior sequência de todos os tempos, placar mais elástico, marcas redondas (10º jogo, 100 pontos, 50ª vitória) | desde sempre |

Nos dados reais do Vôlei Unaerp, o mural de hoje sairia assim:

```
Douglas   12 vitórias · 17 jogos · maior seq 7 · 188 pontos · dupla: Wily (5x)
Wily       8 vitórias · 14 jogos · maior seq 4 · 149 pontos · dupla: Douglas (5x)
Kaio       7 vitórias · 13 jogos · maior seq 2 · 131 pontos · dupla: Douglas (4x)
```

E nos recordes: partida mais elástica Raul+Laura 3×12 Eli+Mateus napa; mais
apertada Eli+Be 12×10 Pati+Raul.

## Por que três e não uma

Contador absoluto premia quem vem sempre — é o efeito desejado —, mas deixa
quem começou hoje no fim da lista para sempre. **"A noite passada" é o
contrapeso**: zera toda semana, e ali qualquer um aparece no primeiro dia.

## Cuidados

- `home.component.ts` tem 593 linhas. Faixa é componente, não mais um bloco
  dentro dele.
- Nenhum `%` nas três faixas. Aproveitamento, melhor dupla por percentual e
  afins vivem na tela de estatísticas (ticket 05) e no perfil do jogador.
- Vôlei sem sessão nenhuma: a home não pode mostrar três faixas vazias — mostra
  o convite de criar a primeira sessão, como hoje.
- Marcas redondas precisam de limite: 3 por pessoa, as mais recentes, senão a
  faixa vira lista de troféus de participação.

- [ ] Três faixas, cada uma com seu recorte
- [ ] Dupla do coração all-time mesmo com a janela ligada
- [ ] Nenhum `%` na home
- [ ] Faixas extraídas como componentes
- [ ] Vôlei novo (sem sessão) continua com a home de hoje
- [ ] AXE limpo nas três faixas
