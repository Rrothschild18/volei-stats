# 38: O captcha do login anônimo

**What to build:** O endpoint anônimo do Supabase é aberto: `signInAnonymously()`
cria uma linha em `auth.users` para quem pedir, sem credencial nenhuma. Hoje a
proteção é só o rate limit do projeto. Falta o lado do app do Turnstile — o
widget, o token, e o que a tela diz quando ele não vem.

A secret já está salva no Supabase. O que não existe é nada no app: nem site
key, nem script, nem o token na chamada.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## Por que isto, e por que não é urgente

A sessão anônima **é** o modelo de acesso (docs/PLANO-SUPABASE.md §1): a
primeira visita abre uma, e é ela que o navegador guarda. Não há conta para
criar, então não há senha para proteger a porta. O que sobra é o Turnstile.

O que se perde sem ele não é dado — as políticas do banco só liberam para
`authenticated`, dentro do grupo de que a pessoa é membro, e uma sessão anônima
nova não é membro de nada. O que se perde é **a tabela de usuários**: alguém com
um laço de dez linhas enche `auth.users` e come a cota do projeto grátis.

Por isso o rate limit segura o caso de hoje (ninguém sabe que o app existe) e
não segura o caso de amanhã. E por isso este ticket vem depois de o vôlei de
verdade estar rodando: ele mexe exatamente no caminho que todo mundo atravessa
na primeira visita, e um captcha quebrado não deixa ninguém entrar.

## Onde o token entra

Um lugar só, e ele não é uma tela:

```
SupabaseService.#signInAnonymously()
  → this.client.auth.signInAnonymously({ options: { captchaToken } })
```

Isto é o nó do ticket. `ensureSession()` é chamado de dentro de cada repositório,
no fundo de uma leitura qualquer — não há tela ali para desenhar um widget. O
token tem de ser conseguido de um serviço, não de um componente:

- **`CaptchaService`** (`core/captcha/`), `providedIn: 'root'`: carrega o script
  uma vez, renderiza o widget e devolve `Promise<string>` com o token.
- **Um componente no esqueleto do app** (`app.ts`, ao lado de
  `<app-net-progress />`) que é o dono do elemento onde o widget monta e da
  moldura que aparece **se** o desafio virar interativo.
- O serviço avisa o componente (sinal), o componente mostra, o serviço resolve.

Sem widget invisível por padrão isto não fecha. Com ele, o caminho normal é: a
pessoa abre o app, nada aparece, e a sessão nasce.

## O widget

Script: `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`,
carregado **sob demanda** — não em `index.html`. A primeira tela do app não
depende dele, e um `<script>` de terceiro no `<head>` atrasa a pintura de todo
mundo, inclusive de quem já tem sessão guardada e nunca vai precisar de token.
A documentação da Cloudflare pede que o arquivo venha desta URL exata: não vale
copiar nem servir de cache próprio.

Renderização explícita, e as duas opções que decidem o desenho da coisa:

```
turnstile.render(elemento, {
  sitekey,
  appearance: 'interaction-only',   // só aparece se precisar de gente
  execution: 'execute',             // o desafio roda quando o app pedir
  callback, 'error-callback', 'expired-callback',
})
turnstile.execute(elemento)
```

`interaction-only` + `execute` é o par que faz o caminho normal ser silencioso:
a maioria das visitas passa sem nada na tela, e a moldura com o desafio só
existe nas que a Cloudflare resolve desafiar.

O token é **de uso único e vale 300 s**. Como ele é pedido no instante anterior
ao `signInAnonymously`, a validade não é problema — a menos que a pessoa deixe
o desafio aberto. Aí `turnstile.isExpired()` e `turnstile.reset()`, e não um
token velho sendo reenviado.

## A site key

Pública, igual à chave publicável, e pelo mesmo motivo: ela vai no bundle que o
Pages serve. Então entra como **variável** do Actions, não como segredo, e o
README já tem o parágrafo que explica por que a distinção importa.

- `src/environments/environment.ts` e `environment.prod.ts` ganham
  `turnstileSiteKey`.
- `scripts/env-producao.mjs` escreve a de produção, de `vars.TURNSTILE_SITE_KEY`.
- **Site key vazia = sem captcha.** O `CaptchaService` devolve `undefined` e
  `signInAnonymously` vai sem `captchaToken`, exatamente como hoje. É isto que
  mantém o desenvolvimento local e a metade `banco` da suíte de ponta a ponta
  funcionando sem nada de Cloudflare: o `supabase/config.toml` tem
  `[auth.captcha]` comentado, e o banco local não pede token nenhum.

## A ordem de ligar, que é a parte que quebra

As duas pontas têm de subir em ordem, e a ordem errada derruba o app publicado
para todo mundo:

1. Variável `TURNSTILE_SITE_KEY` no GitHub, e **deploy**. O app passa a mandar
   token; o dashboard ainda não pede. Nada muda para quem usa.
2. Só então: Supabase → Authentication → Attack Protection → **Captcha ligado**,
   provider Turnstile (a secret já está lá).

Invertido, existe uma janela em que o dashboard exige um token que o app
publicado não manda — e nessa janela ninguém abre o app, nem quem já estava
dentro, porque `ensureSession()` está no caminho de toda leitura.

O passo 2 é de quem tem o dashboard na mão, não do agente. O ticket só fica
pronto quando ele acontece, e a verificação final é abrir o app publicado num
navegador sem sessão guardada (aba privada).

## O que a tela diz quando não dá

É o risco do ticket, e o que separa "captcha ligado" de "app tijolo". Três
falhas, três respostas diferentes:

- **Sem rede.** `ensureSession()` já para antes, com `OFFLINE_MESSAGE`, e é
  isso que tem de continuar acontecendo: a checagem de `navigator.onLine` vem
  **antes** de pedir token. Pedir captcha offline daria uns segundos de espera
  para chegar na mesma frase.
- **Script bloqueado** (bloqueador de anúncio, rede corporativa, Cloudflare
  fora). O app não consegue abrir sessão nenhuma. Isto precisa de mensagem
  própria — não o erro cru do `createClient`, e não a mesma frase de "sem
  conexão", porque a saída é outra: desligar o bloqueador. Com teto de espera
  para o carregamento do script, senão a tela fica em branco para sempre.
- **Token recusado** (`error-callback`, ou o Supabase devolvendo erro de
  captcha). Reset do widget e um botão de tentar de novo. Não vale laço
  automático: se a Cloudflare está recusando, insistir sozinho só gasta
  tentativa.

O teto de espera do `fetch` (`TIMEOUT_MS`, 8 s) **não** se aplica aqui: esperar
uma pessoa resolver um desafio não é esperar um socket, e 8 s é pouco para
alguém clicando em imagens. O desafio interativo tem teto próprio, bem mais
largo.

## Acessibilidade

O desafio é um iframe da Cloudflare: o que está dentro dele não é nosso. O que
é nosso é a moldura, e ela tem de passar no AXE como qualquer outra:

- A moldura é um diálogo de verdade (`role="dialog"`, `aria-modal`, rótulo), com
  o foco indo para ela quando aparece e voltando para onde estava quando sai —
  o mesmo `appFocusTrap` que as outras folhas já usam.
- O contêiner do widget tem nome acessível. Um iframe sem título é violação de
  AXE, e este aparece no caminho de primeira visita.
- Aparecer tem de ser **anunciado** (`aria-live="polite"`): quem usa leitor de
  tela não vê uma moldura surgir no meio do carregamento.
- Texto que diz o que é aquilo. "Confirme que você não é um robô" sozinho não
  explica por que o vôlei está pedindo isso; uma linha basta — é a porta do app,
  e a pessoa veio de um link do zap.

## Uma nota sobre a segunda vez

A sessão anônima é persistida, então o normal é um captcha por aparelho, uma vez
na vida. Mas há dois caminhos que pedem outro, e eles existem:

- `#discardIfOrphan()` desliga a sessão cujo usuário não existe mais (banco
  recriado, conta apagada) — a leitura seguinte abre sessão nova.
- Armazenamento limpo, aba privada, outro navegador.

Nada a fazer além de funcionar: o `CaptchaService` não pode guardar token usado
nem assumir que só é chamado uma vez por carregamento.

## Verificação

As chaves de teste da Cloudflare existem para isto, e tornam a parte do app
testável sem conta nenhuma:

| Chave                                 | O que faz                      |
| ------------------------------------- | ------------------------------ |
| `1x00000000000000000000AA`            | site key, sempre passa, visível |
| `2x00000000000000000000AB`            | site key, sempre falha          |
| `3x00000000000000000000FF`            | site key, força desafio interativo |
| `1x0000000000000000000000000000000AA` | secret, sempre valida           |

Com a `3x…FF` dá para olhar a moldura interativa de verdade — que é o caminho
que ninguém vê em desenvolvimento e todo mundo vê um dia. Com a `2x…AB`, a tela
de token recusado.

- [ ] `CaptchaService` em `core/captcha/`, carregando o script sob demanda e
      devolvendo token de uso único
- [ ] `signInAnonymously` manda `captchaToken` quando há site key
- [ ] Site key vazia = caminho de hoje, sem captcha: local e a suíte `banco`
      continuam passando sem nada de Cloudflare
- [ ] `turnstileSiteKey` nos dois `environment`s e em `scripts/env-producao.mjs`
- [ ] Caminho normal silencioso: `appearance: 'interaction-only'`,
      `execution: 'execute'`, nada na tela quando não há desafio
- [ ] A checagem de `navigator.onLine` continua **antes** do pedido de token
- [ ] Script bloqueado tem mensagem própria, com teto de espera
- [ ] Token recusado reseta o widget e oferece tentar de novo, sem laço
      automático
- [ ] A moldura do desafio é diálogo com foco gerenciado, rótulo no contêiner do
      widget e anúncio `polite`
- [ ] Teste: com a site key que sempre passa, a sessão nasce e a tela não mostra
      nada
- [ ] Teste: com a site key que sempre falha, a tela explica e oferece tentar de
      novo
- [ ] Teste: segunda sessão no mesmo carregamento (depois de descarte de sessão
      órfã) pede token novo, não reusa o anterior
- [ ] README: o parágrafo do dashboard passa a dizer a ordem — deploy com a
      variável primeiro, captcha no dashboard depois
- [ ] **Humano:** ligar Captcha (Turnstile) no dashboard, e abrir o app
      publicado em aba privada
