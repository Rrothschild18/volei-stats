# Regras do VoleiStats

Documento de referência das regras de negócio do projeto, extraídas da
implementação atual (`src/app/core/services`, `src/app/core/facade`) e das telas
que as expõem. Serve como fonte de verdade para discutir mudanças.

> **Como ler este documento**
> As seções 1 a 6 descrevem **o que o sistema faz hoje**.
> A seção 7 lista **inconsistências e defeitos** encontrados na auditoria.
> A seção 8 lista **regras que existem no vocabulário do app mas não no código**.

---

## 1. Conceitos

| Conceito | O que é | Modelo |
| --- | --- | --- |
| **Jogador** (`Player`) | Pessoa cadastrada, com sexo (M/F) e flag `active` | `player.model.ts` |
| **Sessão** (`Session`) | Um dia de jogo. Agrupa os jogadores presentes, os sorteios e os campeonatos daquele dia | `session.model.ts` |
| **Sorteio** (`DrawProposal`) | Uma proposta de divisão dos presentes em duplas, com pontuação e selos | `draw.model.ts` |
| **Dupla** (`Team` / `TournamentTeam`) | Par de jogadores. Dentro do campeonato ganha estado de eliminação | `draw.model.ts`, `tournament.model.ts` |
| **Campeonato** (`Tournament`) | Chaveamento mata-mata disputado por duplas de um sorteio | `tournament.model.ts` |
| **Partida** (`Match`) | Jogo entre duas duplas, com placar e fase | `match.model.ts` |

Hierarquia: **Sessão → Sorteio → Campeonato → Partidas**.
Uma sessão pode ter vários sorteios e vários campeonatos; cada campeonato nasce
de exatamente um sorteio.

---

## 2. Regras do sorteio

### 2.1. Quem entra

Entram no sorteio **os jogadores da sessão** (`session.playerIds`), definidos na
criação da sessão.

### 2.2. Jogador avulso (número ímpar)

Se o número de presentes é ímpar, um jogador fica **em espera** (avulso):

- Ele é escolhido **aleatoriamente** entre os jogadores que **não** estão na
  lista de prioridade.
- Se todos estiverem na lista de prioridade, o sorteio é aleatório entre todos.
- O avulso **não** é redistribuído entre as propostas: o mesmo jogador espera
  nas três opções apresentadas.

> ⚠️ Existe um método `getWaitingPlayerByHistory()` que escolheria **quem menos
> esperou até hoje**, mas ele **nunca é chamado**. Ver §7.3.

> ✅ **REGRA DEFINIDA (§9.1).** A escolha é **aleatória, mas com revezamento
> dentro da sessão**: entre os presentes, só podem ser sorteados os que menos
> esperaram **naquele dia**. O histórico **não** pode ser global — um jogador
> que aparece pouco teria sempre a menor contagem e acabaria esperando toda vez
> que viesse jogar.

### 2.3. Geração das propostas

O serviço gera **100 embaralhamentos** aleatórios, pontua cada um e apresenta as
**3 melhores** ao organizador. A primeira já vem selecionada.

As duplas são formadas sequencialmente a partir da lista embaralhada
(1º com 2º, 3º com 4º, …) e depois **reordenadas** para que as duplas com mais
jogadores prioritários apareçam primeiro — isso define a ordem do chaveamento,
ou seja, **quem joga a primeira rodada**.

### 2.4. Pontuação de uma proposta

Começa em **100 pontos**:

| Critério | Efeito | Selo exibido |
| --- | --- | --- |
| Dupla já jogou junta **nesta sessão** | **−50** por dupla | `Dupla repetida` |
| Dupla do mesmo sexo | **−10** por dupla | `Dupla de mesmo sexo` |
| Jogador com prioridade está em alguma dupla | — | `Prioridade: <motivo>` |
| **Todos** os jogadores prioritários foram escalados | **+20** (uma vez) | — |

A regra de **não repetir duplas** é portanto a de maior peso, seguida pelo
**equilíbrio de sexos** (duplas mistas são preferidas).

Apenas sorteios **selecionados** (`selected: true`) contam como "duplas já
jogadas na sessão".

### 2.5. Ajuste manual

O organizador pode **trocar jogadores de dupla** na tela do sorteio. A troca é
uma permuta: o jogador escolhido vai para a posição clicada e o antigo ocupante
vai para a dupla de origem do escolhido. Os selos de "dupla repetida" são
recalculados após cada troca.

### 2.6. Persistência

Ao confirmar, **as três propostas são salvas**, com `selected: true` apenas na
escolhida, e todas são anexadas à sessão.

---

## 3. Regras de prioridade

Prioridade é o mecanismo de compensação: quem foi prejudicado em um campeonato
entra com vantagem no sorteio seguinte **da mesma sessão**.

### 3.1. Como a prioridade é lida

- Vale **apenas** para campeonatos com status `completed`.
- Campeonatos **em andamento** ou **cancelados** (excluídos) não geram prioridade.
- Considera-se **somente o último campeonato concluído** da sessão.
- Entradas duplicadas (mesmo jogador + mesmo motivo) são removidas.

### 3.2. Motivos de prioridade

| Motivo | Quando é gerado | Quem ganha |
| --- | --- | --- |
| `direct-elimination` | Dupla eliminada na rodada 1 **por maior diferença de pontos** | Os 2 jogadores da dupla |
| `coin-flip-loss` | Jogador perdeu o par-ou-ímpar do encaixe | O jogador eliminado |
| `waiting-player-not-used` | Avulso ficou de fora do campeonato inteiro (encaixe **desativado**) | O avulso |
| `waiting-draw` | **nunca é gerado** — ver §8.1 | — |

### 3.3. Efeito da prioridade

1. O jogador prioritário **não é escolhido** como avulso no próximo sorteio.
2. As duplas que contêm jogadores prioritários são **ordenadas primeiro**, o que
   as coloca na primeira rodada do chaveamento.
3. A proposta ganha **+20 pontos** se todos os prioritários foram escalados.

---

## 4. Regras do campeonato

### 4.1. Configuração

Na criação do campeonato o organizador define:

| Opção | Padrão | Condição de exibição |
| --- | --- | --- |
| **Limite de pontos** | 12 | sempre |
| **Disputa de 3º/4º lugar** | ligado | só com 4 duplas ou mais |
| **Encaixe do jogador avulso** | ligado | só se houver avulso |
| **Prioridade para quem perdeu o par-ou-ímpar** | ligado | só com encaixe ligado |

Regra fixa: com **4 duplas + encaixe**, a disputa de 3º lugar é **forçada a
desligada** (o formato não a comporta).

> ✅ **REGRA DEFINIDA (§9.6).** A disputa de 3º lugar **não é padrão sempre**.
> O padrão depende do formato, e o objetivo dela é **fazer todo mundo jogar pelo
> menos duas vezes**:
> - **4 duplas** → ligada por padrão (é o caso clássico: sem ela, duas duplas
>   jogariam só uma vez);
> - **número ímpar de duplas** (3, 5, 7) → **desligada** por padrão, é raro;
> - **4 duplas + encaixe** → indisponível, o formato não comporta.

Cada campeonato recebe um **nome aleatório** de uma lista de piadas internas.

### 4.2. Formato: chaveamento sem encaixe

A rodada 1 é disputada e, a partir dela, dois critérios comandam o resto:

- **Vencedor com maior diferença de pontos** ganha vantagem (vai direto à final).
- **Perdedor com maior diferença de pontos** é **eliminado diretamente** e recebe
  prioridade no próximo sorteio.

| Duplas | Rodada 1 | Sequência |
| --- | --- | --- |
| **2** | — | Final direta |
| **3** | 1 jogo (duplas 1×2) | Perdedor da R1 × dupla de bye (repescagem) → vencedor vai à final contra o vencedor da R1 |
| **4** | 2 semifinais | Final + 3º lugar (se habilitado) |
| **5** | 2 jogos (4 duplas) | Pior perdedor eliminado direto. Vencedor de menor diferença × dupla de bye → final contra o vencedor de maior diferença. 3º lugar: outro perdedor da R1 × perdedor do bye |
| **6** | 3 jogos | Pior perdedor eliminado direto. Semifinal entre os 2 vencedores de menor diferença → final contra o vencedor de maior diferença. 3º lugar: outro perdedor da R1 × perdedor da semi |
| **7** | 3 jogos (6 duplas) | Pior perdedor eliminado direto. Vencedor nº2 × dupla de bye → semifinal contra o vencedor nº3 → final contra o vencedor nº1. 3º lugar: perdedor do bye × perdedor da semi |

Com **8 duplas ou mais** (16+ jogadores) **não há chaveamento**: o campeonato é
criado mas nenhuma partida é gerada. Ver §7.8.

### 4.3. Formato: chaveamento com encaixe do avulso

O **encaixe** é a regra que coloca o jogador avulso para jogar:

1. A rodada 1 é disputada normalmente pelas duplas do sorteio.
2. Entre as duplas **perdedoras**, a que perdeu por **menor diferença** disputa um
   **par-ou-ímpar** entre seus dois jogadores. (A que perdeu por maior diferença é
   eliminada diretamente.)
3. O organizador informa quem **venceu** o par-ou-ímpar.
4. O vencedor forma uma **dupla nova** com o avulso — a *dupla do encaixe*.
   Essa dupla é marcada como `synthetic` e entra no chaveamento.
5. O perdedor do par-ou-ímpar está eliminado e, se a opção estiver ligada,
   recebe prioridade (`coin-flip-loss`).
6. A dupla original é marcada como eliminada, mas **não** como eliminação direta
   — ela não gera prioridade, e as partidas já jogadas continuam exibindo a
   formação correta (`originalPlayerIds`).

| Duplas originais | Rodada 1 | Sequência |
| --- | --- | --- |
| **3** | 1 jogo | Encaixe × dupla de bye (semifinal-bye) → final contra o vencedor da R1 |
| **4** | 2 jogos | Encaixe × vencedor de menor diferença (semifinal) → final contra o vencedor de maior diferença. **Sem 3º lugar** |
| **5** | 2 jogos (4 duplas) | Encaixe × dupla de bye → semifinal contra o vencedor nº2 → final contra o vencedor nº1. 3º lugar: perdedor da semi × perdedor do bye |

Com **6 ou 7 duplas + avulso e encaixe ligado**, nenhuma partida é gerada —
o campeonato trava. Ver §7.8.

### 4.4. Registro de placar

Validações na hora de salvar uma partida:

- ❌ **Empate é bloqueado** — "Vôlei não tem empate".
- ❌ **0 × 0 é bloqueado**.
- ⚠️ Se o placar do vencedor for **menor que o limite de pontos** configurado,
  exibe aviso mas **permite salvar**.

A diferença de pontos (`pointDifference`) é gravada e é o critério que comanda
todo o chaveamento.

### 4.5. Fim do campeonato

O campeonato é concluído quando **a final foi disputada** e o chaveamento não
gera mais nenhuma partida pendente (ou seja, o 3º lugar já foi jogado ou não
estava habilitado).

### 4.6. Classificação final

1. **1º e 2º**: vencedor e perdedor da final.
2. **3º e 4º**: vencedor e perdedor da disputa de 3º lugar (se houve).
3. **Demais duplas**, nesta ordem:
   - duplas **eliminadas diretamente** ficam por último;
   - entre as outras, **mais vitórias** fica acima;
   - empate em vitórias é desfeito pelo **saldo de pontos**.
4. Com encaixe, a **dupla original desfeita** é exibida fora da classificação,
   como nota de rodapé.

### 4.7. Cancelamento

Um campeonato pode ser **excluído**. Ao excluir:
- todas as suas partidas são apagadas;
- ele é removido da sessão;
- ele deixa de contar para prioridades e estatísticas.

---

## 5. Estatísticas

### 5.1. Por jogador (`PlayerStats`)

- **Jogos**: partidas com vencedor definido em que o jogador estava em uma das duplas.
- **Vitórias / Derrotas**: conforme a dupla dele venceu ou perdeu.
- **Vezes que esperou**: quantos sorteios o tiveram como avulso — conta **todos
  os sorteios salvos**, inclusive as propostas não escolhidas (ver §7.6).
- **% de vitória**: `vitórias / jogos`, arredondado.

Jogadores sem nenhum jogo não aparecem nos rankings.

### 5.2. Por dupla (`TeamStats`)

Duplas são identificadas pelo **par de jogadores** (ordenado), não pelo id da
dupla — então a mesma dupla formada em dias diferentes acumula no mesmo registro.

### 5.3. Dashboard

Destaques calculados: total de partidas, jogadores ativos, maior número de
vitórias, melhor aproveitamento, **melhor dupla (mínimo 3 jogos)**, quem mais
esperou e total de sorteios.

---

## 6. Armazenamento

Hoje tudo vive em **IndexedDB no próprio aparelho** (`volei-stats-db`, versão 1),
com cinco stores: `players`, `sessions`, `draws`, `tournaments`, `matches`.
Não há sincronização: cada celular tem a sua própria base.
Existe exportação para JSON, mas não importação.

---

## 7. Inconsistências e defeitos encontrados

### 7.1. Toggle de 3º lugar ligado ao campo errado 🔴

`tournament-create.component.ts`: o toggle **"Disputa de 3º/4º lugar"** usa
`formControlName="oddPlayerPlacementEnabled"` — o mesmo campo do toggle de
encaixe. Consequências:

- a disputa de 3º lugar **não pode ser desligada** pela interface (fica sempre no
  padrão `true`);
- mexer nesse toggle liga/desliga o **encaixe do avulso**, sem o usuário perceber.

### 7.2. Comentário JSDoc quebrado em `OddPlayerPlacement` 🟡

`tournament.model.ts`: o bloco `/** … /` nunca é fechado e engole a declaração
`sourceTeamId`. O arquivo compila por acidente, porque o campo é declarado de
novo no fim da interface. A documentação dos campos está perdida.

### 7.3. Regra de balanceamento de espera implementada e morta 🔴

`DrawService.getWaitingPlayerByHistory()` escolhe como avulso **quem menos
esperou no histórico** — exatamente a regra justa que se esperaria. Mas nada
chama esse método: `generateProposals` usa `selectWaitingPlayer()`, que é
**puramente aleatório**. Na prática, o mesmo jogador pode esperar várias vezes
seguidas.

### 7.4. As 3 propostas do sorteio podem ser idênticas 🟡

As 100 tentativas não são deduplicadas. Como a ordenação é só por pontuação e
muitas propostas empatam, as "3 opções" oferecidas ao organizador podem ser a
mesma divisão de duplas repetida — ou variar apenas na ordem das duplas.
Além disso, **o avulso é o mesmo nas três**, então não há escolha de quem espera.

### 7.5. Função de leitura com efeito colateral 🔴

`getNextMatches()` chama `markDirectElimination()`, que **muta o campeonato**
(marca duplas eliminadas e grava entradas de prioridade). Mas `getNextMatches` é
chamada em vários pontos só para *consultar* o próximo jogo, e **não persiste**
a mudança. A marcação depende de o fluxo passar por `saveMatch()` depois —
se o usuário sair da tela antes, a eliminação direta e a prioridade **se perdem**.

### 7.6. "Vezes que esperou" conta propostas não escolhidas 🟡

`StatisticsService.getPlayerStats` percorre **todos** os sorteios salvos. Como as
três propostas são persistidas e todas têm o mesmo `waitingPlayerId`, cada
sorteio real conta como **3 esperas**. O mesmo vale para o total de sorteios do
dashboard, que mostra o triplo do número real.

### 7.7. Empate de diferença de pontos sem desempate 🟡

`getRound1WinnersByDiff`, `getRound1LosersByDiff` e `resolvePlacementTeams`
ordenam apenas por `pointDifference`. Com empate — comum em jogos curtos — quem
é eliminado diretamente e quem vai direto à final passa a depender da ordem em
que as partidas foram salvas. Não há critério de desempate definido.

> ✅ **REGRA DEFINIDA (§9.3).** Empate de diferença se resolve **no par ou
> ímpar**, como na quadra. O app não deve decidir sozinho: ele **detecta o
> empate, para, e pergunta** ao organizador quem venceu o par-ou-ímpar —
> exatamente o mesmo fluxo que já existe para o encaixe do avulso.

### 7.8. Formatos não suportados criam campeonato travado 🔴

Nenhuma partida é gerada, e o campeonato fica sem saída, quando:

- há **8 duplas ou mais** (16+ jogadores);
- há **6 ou 7 duplas + avulso com encaixe ligado** (13 ou 15 jogadores);
- há **2 duplas + avulso com encaixe ligado** (5 jogadores).

Não há validação que impeça criar a sessão ou o campeonato nesses casos.

### 7.9. "Último campeonato" depende de ordem não garantida 🟡

`getPriorityEntries` usa `completed[completed.length - 1]` assumindo que o
IndexedDB devolve os registros em ordem de criação. Isso não é garantido pela
API; a ordenação por `createdAt` deveria ser explícita.

### 7.10. Índice `active` do IndexedDB nunca funciona 🟡

`PlayerRepository.getActive()` consulta o índice `active` com `1 as unknown as
IDBValidKey`. IndexedDB **não aceita booleanos como chave**, então esse índice
nunca indexa nada e a consulta sempre volta vazia. O método está morto — o
facade filtra em memória — mas é uma armadilha.

### 7.11. Busca de dupla de bye inconsistente 🟡

`getNext5Team` e `getNext7Team` procuram a dupla de bye com um filtro próprio,
enquanto existe o helper `findByeTeam()` que também exclui duplas `synthetic` e
já eliminadas. Hoje os caminhos não se cruzam, mas a duplicação é frágil.

### 7.12. Carregamento de jogadores em laço (N+1) 🟢

Várias telas buscam jogadores um a um dentro de `for` (`getPlayerById` por id).
Funciona em IndexedDB local, mas vira um problema assim que os dados forem para a
rede.

---

## 8. Regras que existem no vocabulário mas não no código

### 8.1. Prioridade por ter esperado no sorteio

O motivo `waiting-draw` ("ficou em espera no sorteio anterior") está **tipado,
rotulado e com ícone na interface**, mas **nenhum código o gera**. Hoje o avulso
só ganha prioridade se o encaixe estiver desligado (`waiting-player-not-used`).

> ✅ **DECISÃO (§9.5).** O motivo é **removido**. Ele ficou redundante: quem
> esperou no sorteio já é compensado pelo **revezamento de espera dentro da
> sessão** (§9.1), que é um mecanismo melhor. E quem esperou o campeonato
> inteiro continua coberto por `waiting-player-not-used`.

### 8.2. Prioridade entre sessões

Toda a lógica de prioridade é **escopada à sessão** (`getTournamentsBySessionId`).
Quem foi prejudicado no último jogo de uma terça não leva nada para a quinta.
Não está claro se isso é intencional.

### 8.3. Limite de pontos não é aplicado

O limite é só um aviso. Não há regra de "vantagem de 2 pontos", nem de set, nem
bloqueio de placar acima do limite.

### 8.4. Sexo do jogador só afeta o sorteio

`Gender` é usado exclusivamente na penalidade de −10 por dupla do mesmo sexo.
Não há regra de dupla mista obrigatória, nem rankings separados.

---

## 9. Decisões tomadas

Respostas do dono do projeto. Estas são as regras **alvo** — o código deve ser
ajustado para cumpri-las.

### 9.1. Espera: aleatória, com revezamento **dentro da sessão**

A escolha de quem espera é aleatória, **mas só entre os jogadores que menos
esperaram naquele dia**. O revezamento é a regra: ninguém deve esperar duas
vezes enquanto alguém ainda não esperou nenhuma.

O histórico consultado é **o da sessão**, nunca o global. Motivo dado:
*"às vezes a pessoa não joga toda semana e pode sem querer sempre esperar quando
joga"* — com contagem global, quem aparece pouco tem sempre a menor contagem e
seria escolhido para esperar toda vez que viesse.

### 9.2. Prioridade morre no fim do dia

A prioridade é **escopada à sessão**, como já é hoje. Nada atravessa de um dia
para o outro. (Confirma o comportamento atual descrito em §8.2.)

### 9.3. Empate de diferença: par ou ímpar

Quando duas duplas perdem (ou vencem) pela mesma diferença de pontos, o
desempate é **no par ou ímpar**, decidido na quadra. O app detecta o empate,
**interrompe o chaveamento e pergunta** quem venceu — mesmo fluxo que já existe
para o encaixe do avulso.

### 9.4. Encaixe do avulso: confirmado como está

A regra atual está correta e foi confirmada:

- quem **venceu por maior diferença** vai **direto para a final**;
- a **nova dupla** (avulso + jogador do par-ou-ímpar) enfrenta a dupla que
  **venceu por menor diferença**.

### 9.5. `waiting-draw` é removido

Redundante com o revezamento de espera (§9.1). Ver §8.1.

### 9.6. Disputa de 3º lugar: depende do formato

Não é padrão sempre. O objetivo é **todo mundo jogar pelo menos duas vezes**.
Ver §4.1.

### 9.7. As 3 propostas de sorteio precisam ser realmente diferentes

*"Isso é ruim, tem que reaver"* (§7.4). As propostas devem ser **deduplicadas** e
devem **variar também o jogador em espera**, para que a escolha seja real.

### 9.8. Formatos de campeonato viram catálogo genérico

Ver §10.

---

## 10. Formatos de campeonato (direção nova)

Hoje o chaveamento é um `switch` por número de duplas, de 2 a 7, e qualquer coisa
fora disso trava o campeonato (§7.8). A direção definida é outra:

> **O app deve mostrar os formatos possíveis a partir do número de pessoas
> presentes**, e o organizador escolhe.

O formato deixa de ser código escondido e vira **catálogo de dados**, com os
atributos que importam na hora de escolher:

| Atributo | Para quê |
| --- | --- |
| Nº de duplas | filtra pelo que dá para montar com os presentes |
| Precisa de avulso? | formatos com encaixe só aparecem em número ímpar |
| **Quadras necessárias** | formatos de grupos exigem 2 quadras |
| **Mínimo de jogos por dupla** | responde "todo mundo joga pelo menos 2 vezes?" |
| Tem 3º lugar? | obrigatório, opcional ou indisponível |
| Nº total de partidas | quanto tempo vai levar |

### Exemplo que motivou a mudança

Com **12 pessoas (6 duplas) e 2 quadras**, o grupo já jogou um formato que o app
não conhece: **dois grupos de 3 duplas**, classificando as duas melhores de cada
grupo para semifinal e final.

Com o catálogo, esse formato passa a ser uma entrada de dados ao lado do
mata-mata de 6 duplas que já existe — e o organizador escolhe na hora, vendo
quantas quadras cada um exige.

### Consequência para 16+ jogadores

Deixa de ser um caso que trava (§7.8): ou existe um formato cadastrado para
aquele número, ou o app diz claramente que não existe formato e sugere o mais
próximo — em vez de criar um campeonato sem partidas.
