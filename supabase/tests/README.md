# Testes do schema

Rodam o `supabase/schema.sql` num Postgres local e verificam o modelo de acesso
e as regras que viraram constraints. Não precisam de conta no Supabase.

```bash
./supabase/tests/run.sh
```

| Arquivo | O que cobre |
| --- | --- |
| `00-supabase-shim.sql` | Recria o mínimo do ambiente Supabase: `auth.users`, `auth.uid()` e os papéis `anon` / `authenticated` |
| `01-acesso.sql` | Link do grupo, convite de entrada, segundo aparelho, re-associação, convite revogado, e o que cada papel **não** pode fazer |
| `02-regras.sql` | Empate e 0 × 0 recusados, colunas geradas, isolamento entre grupos, nome único por grupo, e a contagem de esperas do §7.6 |
