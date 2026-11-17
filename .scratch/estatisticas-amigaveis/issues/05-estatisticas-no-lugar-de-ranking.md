# 05: "Estatísticas" no lugar de "ranking"

**What to build:** A palavra "ranking" sai do produto. É pódio, e o mural não é
pódio. Vira "estatísticas" em todo lugar visível, e a ordenação por
aproveitamento deixa de ser a régua.

**Blocked by:** None (can start immediately)

**Status:** done

## O que renomear

```
app.routes.ts:80         path: 'rankings'                 → 'estatisticas'
app.routes.ts:83         RankingsComponent                → EstatisticasComponent
app.routes.ts:99         { path: 'rankings', redirectTo: 'voleis' }
rankings.component.ts:63 title="RANKINGS"                 → "ESTATÍSTICAS"
rankings.component.ts:86 "Somando os rankings do vôlei…"  → "Somando as estatísticas…"
rankings.component.ts:123 "Ordem por aproveitamento."      → ordem por vitórias
stats.repository.ts      "Não foi possível ler o ranking"  → "…as estatísticas"
```

São 47 ocorrências de "ranking" em `src/app` (arquivo e teste incluídos), mais
o diretório `features/group/rankings/`.

## A rota antiga tem de continuar funcionando

`/g/<id>/rankings` já foi mandado em grupos de WhatsApp. A rota nova é
`estatisticas`, e `rankings` fica **redirecionando** para ela — não para
`voleis`, como a linha 99 faz hoje para quem chega sem grupo.

## A ordem muda com o nome

A tabela de jogadores é ordenada por `%` hoje (`rankings.component.ts:123`).
Passa a ser por **vitórias**. O `%` continua na tabela como coluna — só não
manda mais na ordem, e a legenda explica a troca.

Mesma coisa na tabela de duplas: ordem por vitórias, e o corte de "3 jogos
juntos ou mais" (linha 163) continua valendo para o cartão de melhor dupla, não
para a listagem.

- [x] Rota, diretório, componente, selector e títulos renomeados
- [x] `/g/<id>/rankings` redireciona para `/g/<id>/estatisticas`
- [x] Ordem por vitórias nas duas tabelas; `%` continua como coluna
- [x] Nenhum "ranking" visível na interface (busca limpa em templates)
- [x] e2e que navegava para `rankings` continua passando

## Comments

### A aba se chama NÚMEROS, não ESTATÍSTICAS

A barra é `grid-cols-4` com rótulo de 12px em caixa alta: "Estatísticas" é o
rótulo mais longo das quatro abas e espremia as vizinhas. O título da tela
continua ESTATÍSTICAS; a aba diz NÚMEROS, que é mais curto e igualmente
amigável.

### A régua mudou em TRÊS telas, não em uma

A posição do jogador aparecia também no perfil (`player-detail`) e no cartão do
seletor de vôleis (`groups.store`), e as duas ordenavam por **aproveitamento**.
Renomear só a tela de estatísticas deixaria a mesma pessoa em 2º num lugar e em
7º no outro. As três passaram a usar `byPlayerWins`, e o rótulo "no ranking"
virou "em vitórias".

### O peso visual seguiu a régua

O `%` era a coluna grande, em azul, e o olho caía nela mesmo com a ordem por
vitórias. V passou a ser a coluna destacada e o `%` ficou pequeno e apagado —
sem isso a tela dizia uma coisa e mostrava outra.

### O corte de 3 jogos saiu da listagem de duplas

Ele existia para o aproveitamento não mentir com amostra de um jogo. Com ordem
por vitórias a dupla de um jogo não lidera nada, e o corte só escondia gente.
