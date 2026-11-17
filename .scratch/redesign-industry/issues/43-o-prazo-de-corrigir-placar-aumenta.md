# 43: O prazo para corrigir placar aumenta

**What to build:** Corrigir placar vale até 30 minutos depois do fim do
campeonato. É pouco: a noite continua, a quadra é devolvida, e só depois alguém
percebe o número errado. O prazo aumenta.

**Blocked by:** None (can start immediately)

**Status:** needs-info — falta o número

## O que já existe (e já é 30 min)

O prazo do ticket 35 está de pé em três portas, e as três dizem o mesmo número:

| Porta  | Onde                                                                  |
| ------ | --------------------------------------------------------------------- |
| Tela   | `standings.component.ts:220`, `score-sheet.component.ts:227`           |
| Store  | `LiveTournamentStore.correctionOpen()` → `correctionWindowOpen()`      |
| Banco  | `correct_match_score`, em `20261101120000_correcao_de_placar.sql:72`   |

A fonte na tela e na store é uma constante só:

```ts
// src/app/core/rules/tournament-timing.ts
export const CORRECTION_WINDOW_MINUTES = 30;
```

O banco repete o número em SQL, com o comentário certo ao lado: _"Mudou um, muda
o outro."_ As telas já interpolam a constante, então a frase ("Este campeonato
fechou. Placar só até N min depois do fim.") acompanha sozinha.

Enquanto a final não saiu, corrigir **já** vale sem prazo. O corte só existe
depois do fim do campeonato — e conta do `playedAt` da final, que de propósito
não se move quando alguém conserta um número.

## O que falta decidir

O número novo. Três candidatos, com o que cada um custa:

1. **12 horas** — encosta em `HORAS_ATE_DESISTIR`, que é quando o app já
   considera um campeonato "não terminou". Mantém a ideia de "a noite de hoje" e
   nunca alcança a sessão da semana seguinte.
2. **Até o fim do dia da sessão** — o mais fácil de explicar em quadra ("hoje dá,
   amanhã não"), e o mais chato de implementar: deixa de ser "N minutos depois do
   fim" e passa a depender do fuso de quem olha. A frase da tela muda de forma.
3. **Sem prazo** — some a regra inteira, some a frase, e o campeonato de duas
   semanas atrás volta a ser reescrevível. O ticket 35 decidiu contra isto com
   um argumento que continua valendo: mexer num campeonato antigo é reescrever
   ranking, prioridade e estatística de gente que não está ali.

Recomendação: **12 horas**. Continua sendo "minutos depois do fim", então é uma
constante e uma linha de SQL — e nenhuma tela, teste ou frase muda de forma.

## O que muda em código, qualquer que seja o número

- `CORRECTION_WINDOW_MINUTES` — o único lugar do TypeScript.
- `20261101120000_correcao_de_placar.sql` já está aplicado na nuvem, então o
  número novo entra por uma migration NOVA que faz `create or replace function
  correct_match_score(...)`. Não se edita migration publicada.
- **Humano:** aplicar a migration no SQL Editor do projeto da nuvem antes do
  deploy (é como as outras entraram; `scripts/checar-migrations.mjs` barra o
  deploy que passar na frente do schema — ticket 41).
- A mensagem de erro do banco cita o número no texto: precisa acompanhar.
- `supabase/tests/05-correcao-de-placar.sql` tem o caso "31 min depois do fim é
  recusado" — o teste passa a usar o prazo novo + 1.
- `tournament-timing.spec.ts` idem.

## Nota: o prazo não é o único portão

Passado o prazo, o dono continua podendo **excluir** o campeonato — é a saída
registrada no ticket 35 para um resultado que ninguém pode mais consertar. O
ticket 45 estende esse excluir para o campeonato em andamento.

- [ ] **Decidir o número** (recomendação: 12 h = 720 min)
- [ ] `CORRECTION_WINDOW_MINUTES` atualizado
- [ ] Migration nova com `create or replace function correct_match_score`, mesmo
      número e mesma mensagem
- [ ] `supabase/tests/05-correcao-de-placar.sql` conferindo o prazo novo
- [ ] `tournament-timing.spec.ts` atualizado
- [ ] Conferir que a frase da tela mostra o número novo sem edição manual
- [ ] **Humano:** aplicar a migration na nuvem antes do deploy
