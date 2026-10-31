# 32: A chave conta a verdade sobre quem está dentro e quem saiu

**What to build:** Olhar a chave e a aba Duplas responde, a qualquer momento, quem já se classificou, quem está jogando e quem saiu — e por quê. Hoje as três respostas estão erradas em pontos diferentes, e todas pela mesma razão: a tela só sabe o que está na fila do próximo jogo.

**Blocked by:** None (can start immediately)

**Status:** done

## O que está errado

Reproduzido num campeonato de **5 duplas (10 pessoas)**, formato "mata-mata com bye", sem disputa de 3º.

### 1. Quem se classificou direto some da chave

A regra (REGRAS.md §10) é clara: *"vencedor de menor diferença × dupla de bye → final contra o vencedor de maior diferença"*. O chaveamento **faz isso certo**. A tela é que não conta.

Logo depois da rodada 1, a chave mostra:

```
SEMIFINAL (BYE)  AGORA   LEO + BIA  ×  GUI + NINA
FINAL            DEPOIS  VENCEDOR   ×  VENCEDOR
```

THIAGO + MALU venceu por 6 e **já está na final** — e a chave desenha os dois lados vazios, como se nada estivesse decidido. A informação existe e está calculada; ela só não é publicada, porque a final só entra na lista de pendentes quando o adversário aparece.

Isso tem uma segunda cara: "você joga a seguir" sai da mesma lista. Quem se classificou direto vê a tela de quem está assistindo, sem saber que já está na final.

**Não é só com 5 duplas.** Vale para todo formato com classificação direta: 3 (o vencedor da rodada 1 espera a repescagem), 5 e 6 (o vencedor de maior diferença), 7 (o vencedor nº1 espera **duas** rodadas). Com 4 duplas não acontece, porque as duas semifinais alimentam a final.

### 2. Na aba Duplas, só a eliminação direta é marcada

Com o campeonato **já encerrado**, a aba Duplas diz:

| Dupla | O que a tela diz | O que é verdade |
| --- | --- | --- |
| RAUL + NINA | em jogo | **campeã** |
| THIAGO + GUI | eliminada direto | eliminada direto ✓ |
| DUDA + CAROL | em jogo | vice |
| LEO + PATY | em jogo | eliminada na rodada 1 |
| MALU + BIA | em jogo | eliminada na semifinal do bye |

Quatro das cinco linhas estão erradas, e continuam erradas para sempre. A causa é estreita: `eliminated` só é marcado em dois lugares — na eliminação direta e na dupla desfeita pelo encaixe. **Perder uma partida não marca ninguém.**

### 3. A etiqueta de eliminação direta deve ser vermelha

Hoje ela usa `tag-neutral`, o mesmo cinza de "fora" e de "desfeita no encaixe". A paleta já tem `--color-danger-*`, e sair do campeonato antes de jogar de novo é a informação mais dura da tela.

### 4. A conferir com quem relatou (NÃO reproduzido)

Foi relatado que a chave chega a dizer que **falta um jogo para a final quando a final já aconteceu**. Com 5 duplas isso não se reproduziu: encerrado, a escada diz "4 de 4 jogos" e a final aparece como jogada. Pode ser o sintoma 1 visto da cadeira de quem foi eliminado — ou outro formato. Confirmar o número de duplas e se havia disputa de 3º antes de fechar este item.

Durante a reprodução apareceu também um erro de concordância: **"Faltam 1 vitórias para o título"**.

- [x] A chave mostra a vaga já decidida: um lado com a dupla, o outro "aguarda", em vez de dois "VENCEDOR"
- [x] Quem se classificou direto é avisado de que está na final, como quem vai jogar a próxima
- [x] Vale para 3, 5, 6 e 7 duplas, com e sem encaixe do avulso
- [x] Perder uma partida marca a dupla como fora, e a aba Duplas diz de que jogo ela saiu
- [x] Campeã e vice aparecem como tais, não como "em jogo"
- [x] A etiqueta de eliminação direta usa o vermelho da paleta
- [x] "Falta 1 vitória", no singular
- [x] Teste de unidade do chaveamento cobrindo a vaga meio decidida, e teste de ponta a ponta percorrendo as cinco duplas até o fim
