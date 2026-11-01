# VoleiStats

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.3.

## Development server

To start a local development server, run:

```bash
pnpm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Rodando contra o banco local

O app fala com o Postgres. Em desenvolvimento ele é local, em Docker, e não
precisa de conta no Supabase:

```bash
supabase start      # Postgres, Auth e Studio, com o schema aplicado
supabase db reset   # refaz o banco e recarrega o cenário de exemplo
pnpm start
```

O `supabase/seed.sql` sobe dois vôleis para clicar, e em nenhum deles alguém
está reivindicado — é com o código, a senha do grupo e a sua data que você entra:

| Vôlei         | Código        | Senha do grupo | O que tem                                                                                |
| ------------- | ------------- | -------------- | ---------------------------------------------------------------------------------------- |
| Vôlei Segunda | `SEGUNDA`     | `segunda99`    | Oito jogadores, a sessão de hoje em andamento, a da semana passada encerrada. Dono: Rafa |
| Vôlei Teste   | `TESTE-VOLEI` | `volei99`      | Vazio de propósito, com Raul como dono                                                   |

Entre como **Raul** nos dois: no Teste ele é dono (cadastra gente, gera o
convite), na Segunda ele só joga. É assim que se vê as duas telas.

A senha do grupo abre **um nome, uma vez**: você a digita junto com a sua data
de nascimento, e daquele momento em diante aquele navegador é aquela pessoa. A
sua data vira a sua chave — é ela, e não a senha do grupo, que te deixa entrar
num aparelho novo.

Depois disso, o nome e a data são seus: em **Seus dados** (`/g/:id/eu`, pelo seu
perfil) você ajusta como quer ser chamado neste vôlei — quem cadastrou digitou
doze nomes de cabeça — e troca a data, sabendo a atual.

### Modo demonstração, sem banco nenhum

`dataSource: 'demo'` em `src/environments/environment.ts` roda o app contra um
cenário em memória (`src/app/core/demo/`), para mostrar sem rede e para os
testes. Nele você é uma pessoa fixa — Caio, jogador no Vôlei Segunda e dono do
Vôlei Trabalho — e não há como entrar nem criar vôlei: entrar depende da data
funcionar como senha dentro do servidor, e uma versão de mentira disso seria uma
versão sem a parte que importa.

O que você fizer sobrevive a um F5, porque o estado fica no `sessionStorage` da
aba. Fechar a aba volta ao cenário inicial, e ele também se renova quando o dia
vira, porque as datas são relativas a hoje.

## O banco na nuvem (produção)

O app publicado no GitHub Pages fala com um projeto do Supabase. As credenciais
dele **não ficam no repositório**: o deploy as injeta em
`src/environments/environment.prod.ts`, que está versionado com os valores
vazios.

No repositório, em **Settings → Secrets and variables → Actions**, aba
**Variables**, crie duas:

| Variável                   | Onde achar no Supabase                                                        |
| -------------------------- | ----------------------------------------------------------------------------- |
| `SUPABASE_URL`             | Project Settings → Data API → Project URL (`https://<ref>.supabase.co`)       |
| `SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → a publicável (`sb_publishable_…`, antes `anon`) |

São **variáveis, não segredos**, e isso é a parte que importa entender: o build
inlina a chave no JavaScript que o Pages serve, então quem abrir o devtools lê
ela. Esconder não é opção, e chamar de segredo o que é público engana quem ler
depois. O que protege os dados são as políticas do banco — toda tabela só libera
para `authenticated`, dentro do grupo de que a pessoa é membro — e o captcha no
login anônimo.

A chave **secreta** (`sb_secret_…`, antes `service_role`) ignora as políticas e
nunca entra aqui, nem como segredo do Actions: o app não precisa dela. O
`sb_secret_…` que existe em `e2e/apoio.ts` é a chave fixa do Supabase local,
igual em qualquer máquina, e só abre o Postgres em Docker da sua.

Ainda no dashboard, uma vez: **Authentication → Providers → Anonymous sign-ins**
ligado (é o modelo de acesso do app), e **Authentication → Attack Protection →
Captcha** ligado, que é a única proteção que o endpoint anônimo pede.

Faltando uma das variáveis, o deploy falha no passo que as lê, de propósito — em
vez de publicar uma tela que não carrega nada e não diz por quê.

Projeto grátis é pausado após ~7 dias sem acesso, e o vôlei é semanal: o
workflow `keepalive.yml` faz uma consulta trivial a cada três dias.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Testes

```bash
pnpm lint             # eslint + angular-eslint
pnpm test             # unidade: regras, stores e o cenário de exemplo
pnpm test:sql         # o modelo de acesso e as regras que viraram constraints
pnpm test:e2e         # ponta a ponta: as duas metades
pnpm test:e2e:demo    # só a metade sem banco — rápida, boa para o dia a dia
pnpm test:e2e:banco   # só a que atravessa o Postgres (pede `supabase start`)
```

A suíte de ponta a ponta tem duas metades, porque o que elas exigem para rodar é
diferente: `demo` roda contra o cenário em memória e cobre as telas de dentro do
vôlei; `banco` sobe o Supabase local e cobre o que só existe com servidor —
entrar, criar vôlei e um campeonato do zero ao fim. O que cada uma garante e como
escrever teste novo está em `e2e/demo/README.md`.

`pnpm test:sql` sobe um Postgres descartável em Docker e aplica as migrations —
não precisa do `supabase start` nem de conta no Supabase.

A metade `banco` precisa do Supabase local de pé (`supabase start`); as duas
sobem o servidor de desenvolvimento sozinhas. Lá cada teste **cria o próprio
vôlei pelo fluxo de criação e apaga o que criou**: nenhum depende do cenário de
exemplo nem da ordem dos outros, e dá para rodar a suíte duas vezes seguidas sem
reset. Na metade `demo` o isolamento é de graça — o cenário vive na aba, e cada
teste abre a sua.

Tudo isso roda na pipeline em todo push e pull request (`.github/workflows/ci.yml`).
