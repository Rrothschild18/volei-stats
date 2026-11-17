# 45: Excluir campeonato em andamento, pela listagem

**What to build:** O dono só consegue excluir um campeonato **depois** que ele
acaba, e só de dentro da tela de classificação. O campeonato que começou errado
— formato trocado, duplas erradas, começou duas vezes — fica preso "ao vivo"
para sempre. Excluir precisa estar na listagem, valendo também para o que está
em andamento.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Onde o excluir mora hoje

Um lugar só:

```
standings.component.ts:225   @if (group.isOwner() && menuOpen()) { ... }
standings.component.ts:591   await this.facade.deleteTournament(this.tournamentId());
```

E a rota da classificação só é alcançável pela listagem quando o campeonato
**não** está ao vivo:

```ts
// tournament-list.component.ts
target: live
  ? ['/g', groupId, 'campeonatos', tournament.id]                    // ao vivo
  : ['/g', groupId, 'campeonatos', tournament.id, 'classificacao'],  // tem excluir
```

Logo: em andamento → nenhuma porta. A tela ao vivo
(`tournament-live.component.ts`) não tem excluir nenhum.

No banco já está liberado: `delete` em `tournaments`, `matches`, `draws`,
`sessions` e `tournament_teams` é `is_group_owner(group_id)`, sem olhar
`status`. Nada de migration.

## O que construir

Na listagem (`tournament-list.component.ts`), nas linhas de **HOJE**, para quem
é dono: excluir. Mesmo diálogo de confirmação que a classificação já usa
("Ele sai das prioridades do próximo sorteio e das estatísticas de todo mundo.
Não tem como desfazer."), com uma frase a mais quando o campeonato está ao vivo
— **os placares já lançados somem junto**, e com N partidas registradas a
confirmação precisa dizer o N.

A linha é um `<button>` que navega; o excluir não pode ser outro botão dentro
dele (botão dentro de botão não é HTML válido e o AXE pega). Vira uma linha com
o alvo de navegação e uma ação à parte ao lado, ou um menu por linha.

O diálogo de confirmação já existe em `standings.component.ts` e vai ser o
segundo uso: vale extrair para `shared/ui` em vez de copiar — duas cópias da
mesma frase sobre apagar coisa alheia é como uma delas fica para trás.

## O risco que precisa ser conferido ANTES

`AppFacade.deleteTournament()` apaga **o sorteio** antes do campeonato:

```ts
if (tournament.drawId) {
  await this.#drawRepo.delete(tournament.drawId);   // ← aqui
}
...
await this.#tournamentRepo.delete(id);              // ← só depois
```

Mas o schema tem:

```sql
foreign key (draw_id, group_id) references draws(id, group_id) on delete restrict
```

`restrict` não é `cascade`: apagar o sorteio **enquanto a linha do campeonato
ainda aponta para ele** é violação de chave estrangeira (23503), e o repositório
transforma isso em `throw`. Se for isso que acontece, o excluir de hoje está
quebrado para o dono — e nenhum e2e cobre exclusão, então ninguém saberia.

Por que pode nunca ter aparecido: para quem **não** é dono a RLS filtra a linha,
o delete volta `DELETE 0` sem erro, e o fluxo segue. O erro, se existe, é só do
dono — que é exatamente quem usa o botão.

**Primeiro passo deste ticket: reproduzir.** Se confirmar, a ordem inverte
(campeonato, depois sorteio) e todo o apagamento vira uma transação só — pela
mesma razão do ticket 35: meia exclusão deixa o banco num estado que ninguém
pediu. Hoje são N chamadas soltas (cada partida, o sorteio, a sessão, o
campeonato), e qualquer uma pode falhar no meio.

## Depois de excluir

- Se o campeonato excluído era o que estava ao vivo, a sessão volta a oferecer
  "NOVO SORTEIO" — `SessionStore` precisa recarregar, não só a lista.
- O sorteio pendente do próximo campeonato (ticket 36), se existir, não é deste
  campeonato e não deve sumir junto.
- Quem estiver com a tela ao vivo aberta em outro aparelho vai bater num
  campeonato que não existe mais: a tela precisa de uma saída honesta ("este
  campeonato foi excluído") em vez de ficar carregando.

- [ ] **Reproduzir** o `on delete restrict` do sorteio com um dono de verdade
- [ ] Se confirmado: ordem de exclusão corrigida e tudo numa transação só
- [ ] Excluir disponível na listagem, para o dono, incluindo campeonato ao vivo
- [ ] A confirmação diz quantas partidas vão junto quando há placar lançado
- [ ] Diálogo de confirmação extraído para `shared/ui` e usado nos dois lugares
- [ ] Sem botão dentro de botão na linha da lista (AXE)
- [ ] Excluir o campeonato ao vivo devolve a sessão a "NOVO SORTEIO"
- [ ] A tela ao vivo de um campeonato excluído diz que ele não existe mais
- [ ] e2e: dono exclui campeonato em andamento com placar lançado; ele some da
      lista e das estatísticas
