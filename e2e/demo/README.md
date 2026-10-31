# Ponta a ponta: a metade sem banco

Playwright contra o app em **modo demonstração**: o cenário em memória de
`src/app/core/demo/`, sem Supabase nenhum. A outra metade da suíte vive em
`e2e/` e roda contra o Postgres de verdade.

```bash
pnpm test:e2e:demo              # só esta metade (sobe o servidor sozinho)
pnpm test:e2e                   # as duas metades
pnpm test:e2e:ui                # modo interativo, bom para escrever teste novo
pnpm test:e2e:demo -- placar    # só um arquivo
pnpm test:e2e:report            # abre o relatório da última rodada
```

Se já houver um `pnpm start:demo` na porta 4300, os testes reusam ele — é o que
torna rápido rodar um teste só enquanto se mexe no app. Na esteira (`CI=1`) o
Playwright sempre sobe o seu.

## Por que modo demonstração

O cenário em memória é igual em qualquer máquina, volta ao início a cada aba
nova e não precisa de `supabase start`. É isso que faz o teste ser repetível: os
11 presentes, a semifinal ao vivo e os meses de histórico são sempre os mesmos.
O que o teste escreve morre com a aba.

A configuração vem de `src/environments/environment.demo.ts`, trocada no build
pela configuração `demo` do `angular.json`.

## O que está coberto

| Arquivo               | O que garante                                                          |
| --------------------- | ---------------------------------------------------------------------- |
| `navegacao.spec.ts`   | a raiz, as rotas desconhecidas, entrar num vôlei, as quatro abas       |
| `voleis.spec.ts`      | a lista de vôleis, o papel em cada um, o destaque da sessão de hoje    |
| `acesso.spec.ts`      | as rotas de dono trancam para jogador; vôlei alheio manda para a porta |
| `jogadores.spec.ts`   | busca, filtro de inativos, abrir a ficha, ações só do dono             |
| `presenca.spec.ts`    | marcar e desmarcar presença, a contagem, salvar a sessão do dia        |
| `placar.spec.ts`      | lançar placar: 0 × 0 e empate não salvam, o salvo trava e anda a chave |
| `campeonatos.spec.ts` | a sessão de hoje, o campeonato ao vivo, o histórico                    |
| `rankings.spec.ts`    | individual, duplas e partidas                                          |

## O que **não** está coberto, e por quê

Entrar por código, criar vôlei e dizer quem você é (`/entrar`, `/criar`,
`sou-quem`) dependem do servidor: a data de nascimento funciona como senha
dentro do Postgres, e o `DemoMembershipService` recusa esses caminhos de
propósito — uma versão de mentira deles seria uma versão sem a parte que
importa. **Isso é o que a metade `banco` cobre**, em `e2e/entrar.spec.ts` e
`e2e/campeonato.spec.ts`; as políticas em si têm teste em `supabase/tests/`.

## Como escrever teste novo

- **Localizar pelo que a pessoa vê**: `getByRole`, `getByLabel`, `getByText`. Não
  há `data-testid` no app, e preferimos que continue assim — um teste que acha o
  botão pelo nome acessível é um teste que também cobre acessibilidade.
- **Caixa alta é CSS.** O DOM guarda "Vôlei Segunda"; a tela mostra "VÔLEI
  SEGUNDA". `toContainText` olha o DOM, então use `/i` quando o texto vem do
  cenário. Texto escrito em caixa alta no template (`JOGADORES`, `DONO`) casa
  como está.
- **Nada de `waitForTimeout`.** As telas carregam em sinais assíncronos; as
  asserções do Playwright já esperam pela condição. Se precisar esperar um
  carregamento antes de agir, afirme algo da tela primeiro.
- **Um teste não depende do outro.** Cada um abre sua aba e começa do cenário
  inicial.
- **Você é sempre a mesma pessoa**: o Caio, jogador no Vôlei Segunda e dono do
  Vôlei Trabalho. O que é de dono se testa no Trabalho (`ID_VOLEI_TRABALHO`), o
  que é de jogador no Segunda — não há trocador de identidade.
- As telas moram em `e2e/demo/pages/`; o que todo teste ganha de graça, em
  `e2e/demo/fixtures.ts`.

## Quando um teste falha

```bash
pnpm test:e2e:demo -- --headed   # ver acontecer
pnpm test:e2e:demo -- --debug    # passo a passo, com o inspetor
pnpm test:e2e:report             # o relatório traz print e trace da falha
```
