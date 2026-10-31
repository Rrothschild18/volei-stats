# Testes do schema

Aplicam as migrations de `supabase/migrations/` num Postgres descartável e
verificam o modelo de acesso e as regras que viraram constraints. É a mesma
definição que o `supabase start` aplica — não existe schema paralelo só para o
teste. Não precisam de conta no Supabase.

```bash
./supabase/tests/run.sh
```

| Arquivo | O que cobre |
| --- | --- |
| `00-supabase-shim.sql` | Recria o mínimo do ambiente Supabase: `auth.users`, `auth.uid()` e os papéis `anon` / `authenticated` |
| `01-acesso.sql` | Link do grupo, convite de entrada, segundo aparelho, re-associação, convite revogado, e o que cada papel **não** pode fazer |
| `02-regras.sql` | Empate e 0 × 0 recusados, colunas geradas, isolamento entre grupos, nome único por grupo, e a contagem de esperas do §7.6 |
| `03-brechas.sql` | Os nove furos que a revisão do modelo de acesso achou: cada um tem aqui o teste que faltava |
| `04-convite-codigo.sql` | O código digitável: caixa e espaço, código escolhido, duplicado, cancelado, e a trava de tentativas |
