# 10: Lançar placar · validação e trava (1n/1o/1p)

**What to build:** Quem está na partida lança o placar numa tela cheia com dois steppers grandes, vê qual dupla está vencendo e o que o resultado produz em seguida. Empate e 0 × 0 não salvam; abaixo do limite o app pergunta. O primeiro placar salvo trava a partida, e só admin corrige.

**Blocked by:** 09

**Status:** done

- [ ] Sheet em tela cheia com kicker da fase, título e `x` de 44×44
- [ ] Duas molduras com o rótulo de origem da dupla, nome 26px e stepper grande; a que está vencendo ganha borda de acento e o rótulo "vence"
- [ ] Nota positiva gerada a partir da próxima partida que o resultado produz
- [ ] Empate bloqueia o salvar com a nota "Vôlei não tem empate"; 0 × 0 também bloqueia
- [ ] Vencedor abaixo do limite abre o diálogo de confirmação citando o limite
- [ ] O botão primário mostra o placar que vai salvar
- [ ] Para jogador, a nota de trava nomeia os admins do grupo e a dupla dele leva o rótulo "VOCÊ"
- [ ] O botão de lançar só aparece para quem está numa das duas duplas e enquanto a partida não tem placar
- [ ] Segunda tentativa de salvar mostra o placar existente com "Já lançado por X às HH:MM"
- [ ] Depois de salvar: tela de placar travado para o jogador (com "AVISAR ADMIN" pelo WhatsApp e "VER CHAVE") e volta à fila para o admin
- [ ] Correção é UPDATE e guarda quem corrigiu

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Sheet de placar com validação de empate e 0×0, confirmação abaixo do limite, trava do primeiro placar e correção só por admin.
