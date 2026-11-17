# 44: Remontar os confrontos com o campeonato rolando

**What to build:** Depois que o campeonato começa, não há como mexer em quem
enfrenta quem. Quando a ordem das duplas sai errada — alguém chegou atrasado, a
quadra virou, o sorteio foi ajustado de boca — a única saída hoje é excluir e
recomeçar, perdendo os placares já lançados. O organizador precisa poder
**reordenar as duplas da chave**, mantendo o que já foi registrado.

**Blocked by:** None (can start immediately)

**Status:** done

## Como a chave nasce hoje

Não existe "ordem dos jogos" guardada em lugar nenhum. A chave inteira é uma
função da **ordem das duplas**:

```ts
// TournamentService.generateInitialMatches()
case 6:
  return [
    { phase: 'round-1', teamAId: teams[0].id, teamBId: teams[1].id },
    { phase: 'round-1', teamAId: teams[2].id, teamBId: teams[3].id },
    { phase: 'round-1', teamAId: teams[4].id, teamBId: teams[5].id },
  ];
```

E essa ordem é persistida:

- `tournament_teams.position`, com `unique (tournament_id, position)`;
- gravada como `position: index + 1` no `upsert` do repositório;
- lida de volta com `.sort((a, b) => a.position - b.position)`.

Ou seja: **reordenar o array `teams` já é, hoje, reordenar a chave.** Não falta
modelo de dados — falta tela, trava e cuidado.

As fases depois da rodada 1 não entram nisto: `getNext*Team()` as deriva dos
resultados, não de `position`. Mexer na ordem não as toca.

## O que sobrevive à reordenação, e o que não

Uma partida já lançada é uma linha em `matches` que aponta para
`team_a_id`/`team_b_id`. **Trocar `position` não mexe em nenhum placar** — os
pontos, o vencedor, a diferença e quem lançou continuam intactos. É isto que o
pedido quer preservar, e ele sai de graça.

O que quebra é outra coisa: a chave reconhece uma partida salva **pelo par de
duplas**, não por id de vaga.

```ts
function samePair(match, phase, teamAId, teamBId) { ... }
```

Com 6 duplas (A×B, C×D, E×F), se A×B já foi jogado e alguém troca B por C, a
chave passa a pedir **A×C** — e a linha de A×B fica órfã: não é mais um
confronto da chave, mas continua contando no saldo, nas estatísticas e nos
rankings. É exatamente o fantasma que o ticket 35 combateu, entrando por outra
porta.

Daí a trava: **uma dupla que já jogou não muda de posição.**

### A trava, em uma frase

Só podem trocar de lugar as duplas cujo confronto da rodada 1 **ainda não tem
placar**. Na tela, as que já jogaram aparecem travadas, com o placar ao lado,
e dizendo por quê.

Casos de borda que a trava já resolve:

- **Formato de 2 ou 4 duplas**, onde a rodada inicial É a final / são as
  semifinais: a mesma regra vale, porque ela olha a partida, não a fase.
- **Dupla sintética do encaixe**: nasce depois da rodada 1, nunca participa da
  rodada inicial e não entra na reordenação. Fica fora da lista.
- **Chave pausada por empate**: a rodada 1 inteira já tem placar, então nada é
  reordenável. A tela diz isso em vez de oferecer um gesto que não faz nada.

## O que precisa existir

1. **Tela.** Na aba do campeonato ao vivo (`tournament-live.component.ts`), uma
   ação "Reordenar duplas" que abre a lista das duplas na ordem da chave, com
   subir/descer por linha. Subir/descer com botão, e não arrastar: arrastar não
   é acessível no teclado nem no leitor de tela, e o AXE pega. Cada linha mostra
   o confronto que a posição produz, para a mudança ser visível antes de salvar.
   Prévia antes de confirmar: "A × B, C × D" vira "A × C, B × D".
2. **Quem pode.** O dono (ADM). A RLS de `tournament_teams` permite `update` a
   qualquer jogador do grupo, então a trava aqui é de tela — e vale registrar
   isso no ticket em vez de fingir que o banco guarda.
3. **Gravação.** O `upsert` de `saveTeams` grava `position = index + 1` para
   todas as duplas numa statement só. Com `unique (tournament_id, position)`
   **não-deferrable**, uma troca 1↔2 pode bater em chave repetida (23505)
   durante o próprio comando. Precisa ser verificado contra o Postgres de
   verdade e, se bater, resolvido — posições temporárias negativas em duas
   passadas, ou uma função `security definer` como a do ticket 35. **Não**
   descobrir isto em produção.
4. **Depois de salvar**, a store recarrega e a fila/escada se redesenham
   sozinhas: elas já são derivadas de `teams`.

## O que NÃO entra aqui

Reordenar a **fila** sem mexer nos confrontos (jogar C×D antes de A×B, mesmos
pares) é outro pedido, e hoje não tem onde morar: a fila não é guardada, é
derivada. Se aparecer, vira ticket próprio com uma coluna de ordem em `matches`
ou numa tabela de vagas.

- [x] Reordenar duplas na chave, com o campeonato em andamento
- [x] Dupla cujo confronto da rodada 1 já tem placar não se move, e a tela diz
      por quê
- [x] A dupla sintética do encaixe fica fora da reordenação
- [x] Prévia dos confrontos novos antes de confirmar
- [x] Subir/descer por botão, operável no teclado (sem drag-and-drop)
- [x] Só o dono vê o gesto; registrar em comentário que a RLS não trava isto
- [x] **Verificar** o `upsert` de posições contra o `unique (tournament_id,
      position)` num Postgres real antes de confiar
- [x] Teste: reordenar antes de qualquer placar muda os confrontos da rodada 1
- [x] Teste: com A×B lançado, A e B não aparecem como reordenáveis
- [x] Teste: reordenar não altera placar, vencedor nem `reported_by` de nenhuma
      partida salva
- [x] Teste: reordenar não deixa partida órfã (nenhuma linha de `matches` fora
      dos confrontos que a chave gera)

## Comments

Feito, e a verificação do banco que o ticket mandava fazer **achou o defeito**.

### A chave única era mesmo um problema

Reproduzido num Postgres de verdade antes de qualquer código de tela
(`supabase/tests/07-reordenar-duplas.sql`): o `upsert` do repositório regrava
todas as duplas numa statement só, e a troca 2 ↔ 3 morre em chave repetida.
`unique (tournament_id, position)` não-deferrable é conferido **linha a linha**,
então o caminho entre dois estados válidos é inválido.

Duas saídas: posições temporárias negativas em duas passadas no cliente, ou a
restrição `deferrable`. Escolhida a segunda
(`20261117130000_posicao_da_dupla_deferivel.sql`), porque arruma no lugar onde o
problema mora e deixa o repositório sem nenhuma esperteza. É `initially
immediate`, não `deferred`: o que muda é o instante da conferência — fim da
statement em vez de linha a linha —, e duas duplas na mesma posição continuam
proibidas. A suíte nova guarda as três coisas.

### A forma do seam mudou no meio

O ticket pedia prévia antes de confirmar, e o primeiro desenho (`moveTeam`, que
gravava a cada toque) não comportava isso. Virou duas peças: `moveInOrder`, pura,
que a folha usa para o rascunho, e `applyTeamOrder`, que grava uma vez e
**reconfere a trava** — a mesma ordem pode chegar de uma aba velha, e aí a tela
não guarda nada (ticket 32).

### O que ficou sem cobertura de ponta a ponta

O gesto é do dono, e no modo demonstração o Caio só é dono do Vôlei Trabalho,
que não tem campeonato em andamento. O e2e cobre o **portão** (quem só joga não
vê o gesto); o resto está em teste de componente (`team-order-sheet.component.spec.ts`,
travadas sem botão, prévia, o que o salvar emite) e no seam do serviço. Atravessar
o fluxo inteiro de dono pede uma sessão ao vivo no Vôlei Trabalho na semente,
que mexeria na contagem de outros testes — fica para quando houver motivo.

### Depois da revisão

Três coisas mudaram, e uma delas era um buraco de verdade:

- **Remontar a chave virou do dono no BANCO**, por gatilho
  (`20261117140000_remontar_a_chave_e_do_dono.sql`). A política de
  `tournament_teams` é de jogador e não olha coluna, então a regra "é do dono"
  vivia só na tela — e a suíte SQL chegou a **fixar** a permissividade, fazendo
  a reordenação como jogadora. Agora o gatilho recusa a troca de `position` de
  quem não é dono, e o resto da linha (eliminada, encaixe) continua sendo
  reescrito por qualquer jogador jogando, que é como o app funciona.
- **A recusa deixou de ser silenciosa.** A folha aberta num aparelho enquanto
  alguém lança um placar no outro: a dupla trava, o serviço recusa, e a folha
  fechava como se tivesse gravado. Agora a store devolve se gravou, a folha fica
  aberta, volta a mostrar a ordem de verdade e diz o que houve.
- **A prévia pergunta à chave.** Ela reimplementava "dois a dois" na tela, o que
  está certo nos formatos de hoje e mentiria no primeiro formato que casasse as
  duplas de outro jeito. Passou por `generateInitialMatches`, que é quem sabe.
