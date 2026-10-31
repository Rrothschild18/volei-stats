# 33: A disputa de 3º é jogada antes da final

**What to build:** Numa noite de vôlei, a final é o último jogo. Hoje o app oferece a final primeiro e a disputa de 3º depois — então o campeão é coroado e as duas duplas restantes ainda têm de voltar à quadra para um jogo que já não decide nada.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

## O código já discorda de si mesmo

A escada da chave **planeja** a disputa de 3º antes da final, e diz isso em voz alta:

```
// A disputa de 3º lugar é jogada antes da final.
const finalIndex = phases.lastIndexOf('final');
phases.splice(finalIndex, 0, 'third-place');
```

Mas a fila do próximo jogo faz o contrário, e faz em **todos** os formatos que
têm 3º lugar — 4, 5, 6, 7 duplas e as variantes com encaixe. Em todos, o
`push` da final vem antes do `push` da disputa de 3º:

```
next.push({ phase: 'final', ... });
if (thirdPlaceEnabled && ...) {
  next.push({ phase: 'third-place', ... });
}
```

Como a primeira da fila é a que a tela chama de **AGORA** e é a que o botão
"LANÇAR PLACAR" abre, a final é anunciada como o jogo da vez.

## O que precisa mudar junto

A ordem está fixada por um teste meu, que travou o comportamento errado:

```
expect(pending.map((bracket) => bracket.phase)).toEqual(['final', 'third-place']);
```

Ele precisa inverter, e é o melhor lugar para a regra ficar registrada.

Vale conferir também o **fim do campeonato** (REGRAS.md §4.5): ele é concluído
quando a final foi disputada e não há mais pendência. Com a ordem corrigida isso
passa a ser naturalmente verdade — a final é a última —, mas a condição merece
um teste que prove que o campeonato não se declara encerrado com a disputa de 3º
ainda por jogar.

- [ ] A fila oferece a disputa de 3º antes da final, em 4, 5, 6 e 7 duplas
- [ ] Vale também nas variantes com encaixe do avulso que têm 3º lugar
- [ ] A escada da chave mostra a mesma ordem que a fila — hoje as duas discordam
- [ ] O campeonato só se declara encerrado depois da final, com a disputa de 3º já jogada
- [ ] O teste que fixava `['final', 'third-place']` passa a fixar o contrário
- [ ] REGRAS.md §10 diz a ordem por escrito, em vez de deixá-la implícita na tabela
