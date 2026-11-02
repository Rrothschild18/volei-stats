# 35: Corrigir um placar refaz o que dependia dele

**What to build:** Corrigir um placar da rodada 1 pode mudar quem empatou, quem foi eliminado e quem foi para o encaixe. Hoje a eliminação direta é refeita e o resto não — as decisões de par-ou-ímpar e o encaixe ficam congelados no resultado antigo, e num dos casos o app passa a decidir sozinho o que a regra diz que ele nunca decide.

Junto com isso: o que a correção invalida precisa SAIR, não ficar guardado ao
lado do resultado novo. E a correção tem prazo — 30 minutos depois do
campeonato encerrar, a noite está fechada.

**Blocked by:** None (can start immediately)

**Status:** done

## O que já é refeito

`closeRound1()` tem o padrão certo e diz por quê:

```
// Corrigir um placar da rodada 1 pode mudar quem saiu por mais pontos:
// a marca é refeita, não acumulada.
```

Ele desmarca a eliminação direta anterior, tira as prioridades dela e remarca.
É esse cuidado que falta nos outros dois lugares.

## 1. A decisão velha de par-ou-ímpar cala o empate novo

`tiebreakAt()` abre com um curto-circuito por TIPO, não por par:

```
if (decisions.some((decision) => decision.kind === kind)) {
  return null;
}
```

Então, havendo qualquer decisão de `losers` guardada, nenhum empate novo de
perdedores é detectado — mesmo entre outras duplas.

Reproduzido: rodada 1 de seis duplas, empate de perdedores entre t2 e t4,
par-ou-ímpar registrado. Corrige-se o primeiro jogo e quem passa a perder é t1.
O empate agora é entre **t1 e t4** — um par que ninguém decidiu. Resultado:

- `needsTiebreak` não aponta o empate dos perdedores;
- `losers[0]` vira `t1` **pela ordem das partidas**, e é ele quem é eliminado
  direto.

Ou seja: o app escolhe quem sai. REGRAS.md §9.3 diz o contrário — "o app não
escolhe sozinho: as duplas fazem par-ou-ímpar e alguém registra".

Nota de quem reproduziu: nesse cenário o que sobrou visível foi o empate dos
**vencedores**, que estava atrás na fila. Isso disfarça o problema — a tela pausa
por outro motivo, e parece que está tudo certo.

## 2. O encaixe não é refeito

`applyOddPlayerPlacement()` sai na porta quando já existe decisão:

```
if (!tournament.waitingPlayerId || tournament.oddPlayerPlacement) {
  return tournament;
}
```

E `closeRound1()` devolve cedo quando o campeonato usa encaixe. Então, depois
que o par-ou-ímpar do encaixe foi aplicado, corrigir a rodada 1 não revisita
nada: a **dupla sintética continua montada com os jogadores da dupla que já não
é a que perdeu por menos**, e a prioridade `coin-flip-loss` continua no jogador
errado.

## 3. O que a correção invalida precisa sair

Hoje `correctScore` grava o placar novo e chama `closeRound1`. Nada é apagado.
Tudo o que foi derivado do resultado antigo continua no banco, ao lado do novo:

- **Partidas que não existiriam mais.** Mudar quem venceu a rodada 1 muda quem
  se enfrenta na semifinal e na final. As partidas já lançadas dessas fases
  foram jogadas entre duplas que o resultado corrigido não manda mais para lá.
  `findSavedMatch` casa por fase **e** par de duplas, então elas não são
  reconhecidas, não são apagadas e continuam contando nas estatísticas, nos
  rankings e no saldo da classificação.
- **A classificação final.** `finalStandings` é gravada uma vez em
  `finishIfComplete` e nunca mais recalculada; `finishIfComplete` nem é chamada
  no caminho da correção.
- **`status: 'completed'`.** Se a correção reabre a chave, o campeonato continua
  marcado como encerrado.
- **As prioridades do próximo sorteio.** `priorityEntries` acumula; `closeRound1`
  limpa as de eliminação direta, as outras ficam.

A regra é uma só, e vale para os três achados: **o que depende de um resultado
é derivado de novo, e o que não sobrevive é apagado.** Nada de resultado antigo
"desconsiderado" na prática mas presente no banco — o que não vale tem de sair,
senão volta a aparecer numa soma qualquer.

Vale verificar no `on delete` das partidas no Supabase se apagar partida de fase
posterior é permitido pelo schema atual.

## 4. Prazo para corrigir: 30 minutos

Corrigir um campeonato encerrado hoje não tem prazo nenhum — o botão "Errou um
placar?" na classificação abre para sempre. Mas um campeonato de duas semanas
atrás já virou ranking, prioridade e estatística de todo mundo; mexer nele é
reescrever o passado de gente que não está ali.

Prazo: **30 minutos depois de o campeonato encerrar.** Depois disso o campeonato
é só leitura.

- O corte é sobre o campeonato, não sobre a sessão: conta do fim da final
  (`playedAt` da final, o mesmo instante que `tournamentTiming` já calcula).
- Enquanto o campeonato está rolando, corrigir vale sem prazo.
- Passado o prazo, o botão de corrigir sai da tela — não fica desabilitado com
  tooltip. E a tela diz por que: "Este campeonato fechou. Placar só até 30 min
  depois do fim."
- O corte não pode valer só na tela: o caminho de correção na store recusa a
  gravação fora do prazo. É a mesma lição do ticket 32 — se a tela é a única
  guardiã, o estado errado entra por outro caminho.
- O dono continua podendo **excluir** o campeonato depois do prazo. Excluir já
  tem confirmação e já diz que some das prioridades e estatísticas; é a saída
  honesta para um resultado que ninguém pode mais consertar.

## O que decidir ao implementar

Uma correção que invalida uma decisão de quadra não pode ser desfeita em
silêncio — alguém fez aquele par-ou-ímpar na beira da quadra. Duas saídas, e o
ticket precisa escolher uma:

1. **Descartar e repedir**: a decisão que não corresponde mais ao empate atual é
   apagada, a chave pausa e pede outro par-ou-ímpar. Honesto e simples de
   explicar; obriga a repetir o gesto.
2. **Manter quando ainda couber**: a decisão sobrevive se as duplas que ela
   nomeia continuarem empatadas entre si; caso contrário é descartada. Menos
   repetição, mais regra para explicar.

A recomendação é a **1**, pelo mesmo motivo que `eliminated` virou estado
derivado no ticket 32: decisão guardada que ninguém revalida é a fonte do
problema, não a solução.

Seja qual for, a tela precisa **dizer** que a correção derrubou a decisão, em
vez de a chave voltar a pausar sem explicação.

- [x] A decisão de par-ou-ímpar só vale para o empate que a gerou; empate novo
      entre outras duplas pausa a chave de novo
- [x] O curto-circuito por tipo em `tiebreakAt` deixa de existir
- [x] Corrigir a rodada 1 revisita o encaixe: dupla sintética e prioridade
      `coin-flip-loss` acompanham o resultado novo
- [x] A tela avisa quando uma correção derrubou uma decisão de quadra
- [x] Teste: empate decidido → correção muda o par → a chave pausa pedindo outro
- [x] Teste: empate decidido → correção não muda o par → a decisão continua valendo
- [x] Teste: correção depois do encaixe aplicado refaz a dupla sintética
- [x] Corrigir a rodada 1 apaga as partidas de fases posteriores que o resultado
      novo não produz mais
- [x] `finalStandings`, `status` e as prioridades são re-derivados na correção,
      não acumulados
- [x] Teste: correção que muda quem vai à final não deixa para trás a final
      antiga contando no saldo e nos rankings
- [x] Corrigir vale até 30 min depois do fim do campeonato; passado o prazo o
      botão sai e a tela explica
- [x] A store recusa a correção fora do prazo, não só a tela
- [x] Teste: correção 31 min depois do fim é recusada na store

## Comments

**Três das quatro partes estão feitas** (commit `0e62b5e`): a decisão por par, o
prazo de 30 min nas duas pontas, a re-derivação de `status` e `finalStandings`, e
a frase que a tela diz quando uma correção derruba um par-ou-ímpar.

Junto saiu um bug que não estava no ticket e que anulava o resto: `saveTiebreaks`
no repositório do Supabase era **upsert sem limpar**. Tirar a decisão da lista na
memória não apagava a linha, e o desempate ressuscitava no carregamento seguinte
da tela. Agora limpa e regrava, como a classificação e as prioridades já faziam.

### O que falta, e por que para aqui

As partes 2 e 3 — refazer o encaixe, e apagar as partidas de fases posteriores
que o resultado novo não produz — **batem na RLS**. O ticket mandava verificar, e
a resposta é não.

Sondado contra o Postgres de verdade (migrations aplicadas num banco
descartável, papel `authenticated`, `request.jwt.claim.sub` de uma jogadora que
não é dona):

| Operação                            | Jogadora | Dono |
| ----------------------------------- | -------- | ---- |
| `update matches` (corrigir placar)  | **pode** | pode |
| `delete from matches`               | não      | pode |
| `delete from tournament_teams`      | não      | pode |
| `delete from tiebreak_decisions`    | **pode** | pode |
| `delete from odd_player_placements` | **pode** | pode |

E o schema diz por que, em comentário, no bloco das políticas:

> a dupla em particular levaria as partidas por cascata — o que daria ao jogador
> uma porta lateral para apagar placar.

Ou seja: não é descuido, é decisão. Apagar placar é do dono porque apagar leva
história embora, enquanto corrigir deixa registrado quem corrigiu.

**O detalhe que torna isto pior do que um erro:** a RLS não recusa o delete, ela
filtra a linha. O `delete` volta com `DELETE 0` e sem erro nenhum. Um app que
tentasse apagar acharia que limpou — e seguiria com a partida fantasma no banco,
contando no saldo e nos rankings, exatamente o que o ticket quer evitar.

Desfazer o encaixe tem o mesmo problema por outro caminho: a dupla sintética do
encaixe é uma linha de `tournament_teams`, e tirá-la é delete de dono.

### As saídas, e o que elas custam

1. **Uma função `security definer` no banco** — `corrigir_placar(partida, placar,
partidas_a_apagar[])`. Autoriza por `is_group_player`, confere que as partidas
   nomeadas são do mesmo campeonato e que nenhuma é da rodada 1, e faz a
   correção e os apagamentos numa transação. A escolha de **quais** partidas caem
   continua no TypeScript, que é quem sabe a chave; a função só autoriza e
   garante atomicidade. De graça, o prazo de 30 min passa a valer no banco
   também — que é mais forte do que "a store recusa", e é a própria lição do
   ticket 32.
   Custo: uma migration nova, e ela precisa ser aplicada **à mão** no SQL Editor
   do projeto da nuvem (é como o schema inicial entrou — não há `db push` na
   esteira).

2. **Corrigir a rodada 1 passa a ser do dono.** Zero banco, zero migration. Mas
   contradiz "a correção depois é de qualquer jogador", que é a regra que fez a
   tela de classificação ganhar o botão de corrigir.

3. **Não apagar: marcar.** A partida fantasma fica, com uma coluna dizendo que
   não vale, e toda soma passa a filtrar. O ticket rejeita isso em uma frase —
   "nada de resultado antigo 'desconsiderado' na prática mas presente no banco" —
   e o custo real é que _cada_ leitura futura precisa lembrar do filtro:
   estatísticas, rankings, saldo da classificação, histórico do jogador.

A recomendação é a **1**. A **2** é o atalho honesto se a migration na nuvem for
o problema.

- [x] **Decidir** entre as três saídas acima antes de continuar
- [ ] **Humano:** aplicar `20261101120000_correcao_de_placar.sql` no SQL Editor
      do projeto da nuvem, ANTES do deploy que depende dela

### A saída escolhida foi a 1, e ela está de pé

`correct_match_score` (migration `20261101120000_correcao_de_placar.sql`): uma
função `security definer` que faz a correção e os apagamentos numa transação só.
A autorização não se perde — é feita explicitamente, com a mesma
`is_group_player` que as políticas usam — e o alcance do apagar é conferido no
corpo dela, não no cliente:

- mesmo campeonato;
- nunca a rodada 1;
- **nunca a própria partida corrigida** (ver abaixo);
- a única dupla desfeita é a sintética do encaixe.

O prazo dos 30 min vive lá também. Agora são três portas — a tela esconde o
botão, a store recusa a gravação, o banco recusa o comando — e só a terceira é
a que uma aba velha, um link antigo ou outro cliente não contornam.

Quem decide **quais** partidas caem continua no TypeScript, que é quem conhece a
chave: `obsoleteMatches` refaz o caminho a partir da rodada inicial e vai
aceitando, camada por camada, o que a chave de fato gera. O que nenhuma camada
alcança não acontece mais.

A suíte SQL ganhou `05-correcao-de-placar.sql`: a jogadora corrige e a fase
posterior sai junto, e cada recusa tem o seu teste (rodada 1, outro campeonato,
dupla do sorteio, quem só é membro, quem é de fora, 31 min depois do fim).

### O defeito que o e2e do banco pegou

A primeira versão de `obsoleteMatches` separava "causa" de "consequência" **por
fase**: tudo que não fosse `round-1` era candidato a cair. Num formato de duas
duplas a rodada inicial É a final — e de quatro, são as duas semifinais. O
resultado foi a suíte `banco` falhando em "um campeonato do zero até o fim":
corrigir o placar único apagava o próprio placar que acabara de ser consertado.

A causa não é a fase, é a **origem**: a rodada inicial é montada do sorteio e não
depende de resultado nenhum, então nunca é invalidada por uma correção. A
derivação passou a partir de `generateInitialMatches`.

E o banco ganhou a trava que não depende de conhecer formato: a partida
corrigida nunca está na lista do que ela mesma apaga.

Fica registrado porque é o tipo de coisa que só aparece atravessando o caminho
inteiro — a cobertura de unidade estava verde com o defeito dentro.

### Uma limitação que ficou, e não é deste ticket

`tiebreak_decisions` tem chave primária `(tournament_id, kind)`: uma decisão de
perdedores e uma de vencedores por campeonato. Com disputa de 3º lugar, a
fronteira dos perdedores olha duas posições, e em tese dois empates separados
entre perdedores pediriam duas decisões — a segunda substituiria a primeira.
Precisa de mudança de chave para resolver, e nunca foi observado em quadra.
