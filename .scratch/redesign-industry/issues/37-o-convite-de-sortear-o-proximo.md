# 37: O convite de sortear o próximo

**What to build:** Ninguém vai descobrir sozinho que já dá para sortear o
próximo campeonato. Quando a condição do ticket 36 cai, a tela do campeonato ao
vivo oferece — um botão flutuante, por cima da lista, que aparece no momento em
que passa a fazer sentido.

**Blocked by:** 36 (a condição e o caminho)

**Status:** blocked

## Por que flutuante

A barra de ação da tela ao vivo já está ocupada com lançar placar, e é ela que
tem de continuar em primeiro plano — o campeonato que está rolando é o assunto.
O convite é oportuno, não urgente: quem não quiser, ignora e segue lançando.

Um botão que **aparece quando a condição cai** é a única parte da tela que
muda sozinha, e é isso que carrega a informação: ele aparecendo já diz "dá para
sortear agora". É por isso que ele não existe desabilitado desde o começo.

## O que ele não pode fazer

- **Cobrir a última linha da lista.** Flutuante por cima de conteúdo rolável
  come a última fila. O conteúdo ganha respiro embaixo do tamanho do botão, do
  mesmo jeito que `app-action-bar` já reserva o seu.
- **Roubar o foco.** Ele aparece no meio de outra tarefa; mover o foco para ele
  interrompe quem está digitando um placar. Ele entra na ordem de tabulação no
  lugar que a posição no DOM der, e nada mais.
- **Aparecer sem ser dito.** Quem usa leitor de tela não vê um botão surgir.
  Precisa ser anunciado por `aria-live="polite"` — polite, não assertive: não é
  interrupção.
- **Ser pequeno.** 44×44 de alvo, WCAG 2.5.5, e contraste AA sobre o conteúdo
  que ele sobrepõe — não vale confiar na cor do fundo da tela, porque atrás dele
  passa lista.
- **Insistir.** Dá para descartar, e descartado ele não volta naquele
  campeonato. Um botão que reaparece a cada rolagem é um anúncio.

## O que ele diz

O texto precisa dizer **por que agora**, não só o que faz. "Sortear o próximo"
não explica a aparição; "Já dá para sortear o próximo" explica. A tela ao vivo
tem espaço para o rótulo inteiro — um FAB redondo só com ícone aqui seria um
enigma, porque não existe convenção para "sortear".

## Bordas

- A condição pode **voltar a ser falsa**: uma correção de placar na rodada 1
  reabre um desempate, e aí o campeonato está pausado de novo. O botão
  desaparece — e se um sorteio já tinha sido tirado, o ticket 36 manda
  invalidá-lo.
- Com um sorteio pendente, o convite muda de texto: já não é sortear, é "o
  próximo já está sorteado". Dois estados, um lugar.
- Quem não joga (visitante) não sorteia. O botão não existe para ele.

- [ ] O botão aparece na tela ao vivo exatamente quando a condição do ticket 36
      cai, e desaparece se ela deixar de valer
- [ ] Não cobre a última linha da lista: o conteúdo reserva o respiro
- [ ] Não move o foco ao aparecer; é anunciado com `aria-live="polite"`
- [ ] 44×44 de alvo e contraste AA sobre conteúdo rolável
- [ ] Dá para descartar, e descartado não volta naquele campeonato
- [ ] Com sorteio pendente, o mesmo lugar diz que o próximo já está sorteado
- [ ] Não aparece para quem não joga
- [ ] AXE sem violação na tela ao vivo com o botão visível
