# 37: O convite de sortear o próximo

**What to build:** Ninguém vai descobrir sozinho que já dá para sortear o
próximo campeonato. Quando a condição do ticket 36 cai, a tela do campeonato ao
vivo oferece — um botão flutuante, por cima da lista, que aparece no momento em
que passa a fazer sentido.

**Blocked by:** 36 (a condição e o caminho)

**Status:** done

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

- [x] O botão aparece na tela ao vivo exatamente quando a condição do ticket 36
      cai, e desaparece se ela deixar de valer
- [x] Não cobre a última linha da lista: o conteúdo reserva o respiro
- [x] Não move o foco ao aparecer; é anunciado com `aria-live="polite"`
- [x] 44×44 de alvo e contraste AA sobre conteúdo rolável
- [x] Dá para descartar, e descartado não volta naquele campeonato
- [x] Com sorteio pendente, o mesmo lugar diz que o próximo já está sorteado
- [x] Não aparece para quem não joga
- [ ] AXE sem violação na tela ao vivo com o botão visível — **não automatizado**

## Comments

**Implementado** como `shared/ui/floating-invite`, usado só pela tela ao vivo
por enquanto. A região `aria-live="polite"` vive sempre no DOM e fica vazia
enquanto não há convite: uma região criada junto com o conteúdo não anuncia
nada. O respiro embaixo é um espaçador no fim do conteúdo, que só existe quando
o convite existe — um teste de ponta a ponta rola até o fim e compara as
coordenadas, porque isto é o tipo de coisa que volta a quebrar em silêncio.

Duas observações sobre o desenho:

- **A premissa da barra ocupada não se confirmou.** A tela ao vivo não tem
  `app-action-bar`: "LANÇAR PLACAR" mora dentro do `app-hero-field`, no topo. O
  flutuante foi feito como o ticket pede, mas um convite em fluxo normal (logo
  abaixo do hero) dispensaria sobreposição, respiro reservado e contraste sobre
  lista. Fica registrado caso o flutuante incomode no uso.
- **O descarte é por campeonato e por aba** (`sessionStorage`): a memória não
  precisa durar mais que a noite, e não é dado do grupo — é a escolha de quem
  está com o telefone na mão. Sem armazenamento (aba privada), o convite volta;
  nada quebra.

**AXE não foi verificado automaticamente**: o projeto não tem `@axe-core` nas
dependências, e não adicionei uma por conta disto. O que dava para garantir sem
ele está testado: alvo de 44 px medido na tela, `aria-live="polite"`, foco que
não se move, rótulo no botão de descartar, e o preenchimento `accent-700` com
texto claro (5.8:1, a mesma regra de contraste do botão primário) sobre fundo
sólido, para não depender do que passa atrás.

Não aparece para quem não joga via `group.canPlay()` — não coberto por teste
porque no modo demonstração a pessoa é sempre a mesma, e visitante só existe
contra o banco.
