# Estatísticas amigáveis

**O que é:** a página de números do vôlei deixa de ser um pódio e passa a ser um
mural. A régua é **vitórias acumuladas**; aproveitamento, melhor dupla e
qualquer `%` continuam existindo, mas nunca como classificação. Junto vem o que
o grupo de fato comenta no WhatsApp: sequências, partida mais apertada, quem
fechou a quadra, o resumo da noite em imagem.

## Por que

O ranking de hoje ordena por **aproveitamento**
(`rankings.component.ts:123` — "Ordem por aproveitamento"), e isso é injusto de
três jeitos ao mesmo tempo, num grupo onde parte das pessoas não é competitiva:

1. **Amostra pequena vale como verdade.** Nos dados reais do Vôlei Unaerp
   (2 noites, 8 campeonatos, 32 partidas), Mateus napa lidera com 86% em 7 jogos
   de uma noite só; Douglas tem 71% em 17 jogos nas duas noites.
2. **A dupla é sorteada.** Metade do resultado é o parceiro que o sorteio deu, e
   o ranking individual cobra isso da pessoa.
3. **`%` pune quem joga muito.** Contador absoluto só sobe: quem vem sempre
   sobe, o que premia presença em vez de talento.

Um ranking por rating ajustado (Bradley-Terry/Elo de duplas) foi considerado,
prototipado contra os 32 jogos reais e **descartado de propósito**: resolve a
justiça estatística e erra o objetivo do produto, que é ser esportivo e
acolhedor.

## Decisões

| Decisão | Valor |
| --- | --- |
| Régua | vitórias acumuladas |
| Janela padrão | as **4 últimas sessões** (deslizante), com botão para todo o histórico |
| Dupla do coração | **all-time**, sempre — duplas tendem a não se misturar |
| Sequência | expira: conta até a última noite em que a pessoa jogou |
| Palavra | "estatísticas", nunca "ranking" |
| Sorteio | **intocado** — nada daqui entra na pontuação de proposta (REGRAS §2.4) |
| Dupla mista | continua regra de sorteio (−10 por dupla do mesmo sexo); **não** é estatística |

A janela é **deslizante**, não cíclica: uma noite boa continua melhorando os
números da pessoa até "passar" da quarta sessão para trás.

## Fora de escopo (decidido, não esquecido)

Rating/MMR e qualquer ordenação por `%`; quantos parceiros diferentes;
combinações inéditas; duplas mistas como estatística; bastidores (placarista,
juiz, batizador); MVP votado; destaque manual da partida; logística da noite
(bola, quadra, caixa); horário de chegada.

## Um achado que define o slider (ticket 01)

**Dupla × dupla nunca se enfrentou duas vezes:** 32 confrontos distintos em 32
partidas. Não é azar — o sorteio tira **−50 por dupla repetida** (REGRAS §2.4),
então o mesmo par contra o mesmo par é quase impossível por construção.
"Quantas vezes se enfrentaram" entre as duas duplas daria **0** em praticamente
todo jogo.

O que tem dado, nos mesmos 32 jogos:

- **cada dupla separada**: Douglas+Wily jogaram juntos 5x, Douglas+Kaio 4x,
  Pedrão+Wily 3x, Binho+Pedrin 3x;
- **jogador × jogador em lados opostos**: 65 pares, 16 deles já se cruzaram 3
  vezes ou mais (Kaio×Wily 5x, Douglas×Wily 5x, Be×Wily 4x).

O slider se apoia nesses dois. O confronto de duplas entra só como "inédito".

## Onde isso mora hoje

```
features/group/rankings/rankings.component.ts     451 linhas — a tela a renomear
features/group/home/home.component.ts             593 linhas — as três faixas
features/group/tournaments/score-sheet.component.ts        — o aviso de 0×0 e o slider
features/group/tournaments/tournament-list.component.ts    — o novo lugar do NO ZAP
core/services/statistics.service.ts               — o caminho demo, com StatsScope
core/repositories/supabase/stats.repository.ts    — lê as views
supabase/migrations/…_schema_inicial.sql:1321     — player_match_results
                                         :1336     — player_stats
                                         :1367     — team_stats
app.routes.ts:80 e :99                            — a rota 'rankings'
```

As views `player_stats` e `team_stats` somam **tudo, sem filtro de sessão** — é
por isso que a janela de 4 sessões (ticket 04) não é só trabalho de front.
`player_match_results` já carrega `session_id` e `played_at`, e é por ali que a
janela sai barato.

## Ordem

```
01 slider no placar          (autocontido, tela mais usada)
02 resumo esportivo da sessão
03 NO ZAP sai do fim do jogo → imagem na listagem   (depende de 02)
04 janela das 4 últimas sessões                     (migration de view)
05 "estatísticas" no lugar de "ranking"
06 a home em três faixas                            (depende de 04 e 05)
07 par-ou-ímpar, lado da quadra e saque inicial     (migration)
08 placar ponto a ponto e a bola do sacador         (depende de 07)
```

## Perguntas abertas (o dono decide depois)

1. **Média de pontos** no slider: média dos pontos que a dupla fez, ou média do
   placar total do jogo?
2. **Empate** em "mais vitórias" / "maior sequência": mostra os dois nomes, ou
   desempata por algo?
3. O slider do placar usa a **janela de 4 sessões** ou sempre o histórico
   completo?
4. **"Vezes que esperou"** (hoje em `rankings.component.ts:123`) fica no mural,
   vai para o perfil do jogador, ou sai?
5. **"Quem fechou a quadra"** são os 4 jogadores da última partida, ou só a
   dupla que venceu?

> Nota: o §7.6 do REGRAS.md ("vezes que esperou conta propostas não escolhidas")
> está **desatualizado** — a view `player_stats` e o `StatisticsService` já
> contam apenas sorteio `selected`. O texto do REGRAS §5.1 é que precisa de
> conserto.
