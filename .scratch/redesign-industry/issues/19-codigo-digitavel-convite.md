# 19: Código digitável no convite

**What to build:** O convite passa a ter um código curto que a pessoa consegue digitar, além do link. Quem é dono vê o código, pode trocá-lo por um escolhido ("TESTE-VOLEI"), revogar e gerar outro. Quem digita um código errado demais vez seguida para de poder tentar.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Código gerado com 6 caracteres de um alfabeto sem ambiguidade (sem O/0, sem I/1), único no banco
- [x] Comparação indiferente a caixa e a espaços nas pontas
- [x] O dono pode definir um código escolhido, mais longo, com letras, números e hífen
- [x] Resgatar por código funciona exatamente como resgatar pelo token do link
- [x] Código revogado deixa de resgatar, e o dono gera outro
- [x] Trava de tentativas no resgate por código, para que adivinhar não renda a lista de nomes
- [x] A suíte SQL cobre: resgate por código, caixa trocada, código revogado, código duplicado e a trava
