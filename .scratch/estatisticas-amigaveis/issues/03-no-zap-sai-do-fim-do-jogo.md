# 03: O NO ZAP sai do fim do jogo e vira imagem na listagem

**What to build:** Ao salvar o placar, a barra de ação fica **só com VER
CHAVE**. O NO ZAP muda de lugar: vai para a **listagem de campeonatos** e passa
a gerar uma **imagem** do resumo (ticket 02) para postar, em vez de uma
mensagem de texto.

**Blocked by:** 02

**Status:** done

## Como está hoje

```
score-sheet.component.ts:166   <button (click)="shareScore()"> NO ZAP   ← sai
score-sheet.component.ts:172   <button (click)="closed.emit()"> VER CHAVE  ← fica, sozinho
score-sheet.component.ts:446   shareScore(): window.open(`https://wa.me/?text=…`)
```

O compartilhar de hoje é **texto puro** por `wa.me/?text=`: manda
`"<campeonato>: <dupla> 12 × 10 <dupla>"`. Fim de cada jogo é o pior momento
para isso — o pessoal quer ver a chave, não escrever no grupo.

A barra passa de `app-action-bar [pair]` para uma ação só, e o VER CHAVE
continua `btn-primary`.

## O novo lugar

`tournament-list.component.ts` (537 linhas), por linha de campeonato. Quem toca
recebe a imagem do resumo do ticket 02, com o placar daquele campeonato.

## O detalhe técnico que decide o ticket

**`wa.me/?text=` não carrega imagem.** Uma URL de WhatsApp só leva texto. Para
mandar imagem é preciso:

1. desenhar o resumo em `<canvas>` (ou SVG → canvas) e extrair um `Blob` PNG;
2. `navigator.share({ files: [new File([blob], 'volei.png', …)] })` — Web Share
   API nível 2, que é o caminho no Android e no iOS recentes;
3. **fallback obrigatório**: navegador sem `share` de arquivo (desktop, Firefox)
   baixa o PNG e copia o texto, com uma frase dizendo o que aconteceu.

`invite.component.ts:257` já tem o padrão de `navigator.share` com fallback para
`clipboard` — vale reusar a forma, não copiar o código.

## O desenho da imagem

- Proporção que o WhatsApp não corta na pré-visualização (1080×1350 ou 1080×1080)
- Legível em miniatura: nome do vôlei, data, e **no máximo 5 destaques**
- Fonte embutida ou fallback declarado: fonte que não carregou vira imagem feia
- Sem foto de ninguém, sem dado que o grupo não veria na tela

- [x] Fim do jogo com uma ação só (VER CHAVE)
- [x] NO ZAP por campeonato na listagem
- [x] PNG gerado no cliente, compartilhado por `navigator.share` com arquivo
- [x] Fallback de download + texto copiado, com aviso
- [x] Imagem legível em miniatura, sem corte
- [x] `shareScore()` removido do `score-sheet.component.ts`

## Comments

### Onde o NO ZAP mora agora

No resumo da noite (tela da sessão e faixa "a última noite" da home) e no bloco
HOJE da listagem de campeonatos. No placar salvo ficou só VER CHAVE.

### A imagem

`SummaryShareService` desenha 1080 × 1350 num canvas, com as fontes do app
carregadas antes (`document.fonts.load`) — fonte que não carregou vira a padrão
do sistema sem erro nenhum. No celular vai pelo `navigator.share` com arquivo;
onde isso não existe, baixa o PNG e abre o WhatsApp com o resumo em texto, e a
tela diz o que aconteceu.

A tela, a imagem e o texto saem da mesma função (`linhasDoResumo`), para as
três dizerem a mesma coisa.
