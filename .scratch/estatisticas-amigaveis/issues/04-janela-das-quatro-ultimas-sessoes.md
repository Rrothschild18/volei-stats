# 04: A janela das 4 últimas sessões, com escape para o histórico

**What to build:** Por padrão, as estatísticas olham as **4 últimas sessões**.
Um botão troca para **todo o histórico do vôlei**. A janela é **deslizante**:
quem jogou muito bem numa noite mantém os números melhores até aquela sessão
"passar" da quarta para trás.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Por que não é só trabalho de front

As views do banco somam **tudo, sem filtro de sessão**:

```sql
-- schema_inicial.sql:1336
create or replace view player_stats … from players pl
left join ( select player_id, count(*) … from player_match_results group by player_id ) r …
```

Então "últimas 4 sessões" não dá para filtrar na consulta de hoje: a soma já
veio fechada. A saída barata é que `player_match_results`
(schema_inicial.sql:1321) **já carrega `session_id` e `played_at`** — falta
agregar por sessão:

```sql
create or replace view player_session_stats with (security_invoker = true) as
select group_id, session_id, player_id,
       count(*) as games_played,
       count(*) filter (where won) as wins,
       count(*) filter (where not won) as losses
from player_match_results
group by group_id, session_id, player_id;
```

O cliente soma as N sessões que quiser — 4 ou todas — e `player_stats` continua
existindo para quem quer o total. Mesma ideia para duplas
(`team_session_stats`), se o mural precisar.

## O caminho que já está pronto para isso

`statistics.service.ts` (o caminho demo) já recebe o recorte:

```ts
export interface StatsScope {
  readonly sessionIds: ReadonlySet<string>;
  readonly playerIds: ReadonlySet<string>;
}
```

A janela é montar esse `StatsScope` com as 4 sessões de maior `date`. O
`StatsRepository` do Supabase é que não tem equivalente — é o que esta view
resolve.

## A sequência expira

Hoje nada calcula sequência. Quando calcular, ela **conta até a última noite em
que a pessoa jogou**: nos dados reais, Mateus napa tem 6 vitórias seguidas da
noite de 09/11 e não apareceu dia 16 — mostrá-lo "em chamas" é mentira. A
sequência histórica (recorde) é outra coisa e não expira.

## A troca na tela

- Um controle só, com dois estados: **"Últimas 4 noites"** ↔ **"Desde sempre"**
- O estado escolhido vale para a tela toda, não por cartão
- **Dupla do coração é exceção: sempre all-time**, em qualquer estado — duplas
  tendem a não se misturar, e uma janela de 4 noites esvaziaria o cartão
- Precisa dizer **qual recorte está no ar**, senão o número muda e ninguém sabe
  por quê

## Migration

Vai à nuvem por comando, não pela esteira: `supabase db push --linked`
(README §deploy). Como é view nova, `--dry-run` primeiro.

- [ ] View `player_session_stats` (e a de duplas, se preciso)
- [ ] `StatsRepository` lê por sessão e soma no cliente
- [ ] `StatsScope` montado com as 4 últimas sessões
- [ ] Botão "Últimas 4 noites" / "Desde sempre", com o recorte visível na tela
- [ ] Dupla do coração ignora a janela
- [ ] Sequência viva expira na última noite jogada; recorde não
- [ ] Teste SQL da view nova (`supabase/tests/`)
- [ ] Grupo com menos de 4 sessões: a janela é o que existe, sem erro
