# 08: Formato do campeonato · catálogo e sem-formato (§10, §9.6, §7.8)

**What to build:** Com a proposta escolhida, o admin escolhe o formato entre os que cabem no número de presentes, vê quantas partidas e quantas quadras cada um pede, ajusta o limite de pontos e as opções que aquele formato comporta, e começa o campeonato. Quando não existe formato para o número que apareceu, a tela oferece saídas em vez de criar um campeonato travado.

**Blocked by:** 07

**Status:** done

- [ ] Cards de formato a partir de `formatsForPlayerCount(n)`, com radio, nome, resumo e a grade de 4 números (partidas · quadras · mín./dupla · 3º)
- [ ] O primeiro da lista marcado como RECOMENDADO e pré-selecionado
- [ ] Variante com o avulso fora quando o número é ímpar, explicando que ele ganha prioridade no próximo sorteio
- [ ] Sugestão tracejada com `nearestPlayableCounts` e os formatos `planned` marcados EM BREVE
- [ ] Limite de pontos no stepper compacto, padrão 12, mínimo 1
- [ ] Switch de 3º lugar só quando `thirdPlace === 'optional'`, começando em `thirdPlaceDefault` e gravando em `thirdPlaceEnabled` (não mais no campo do encaixe)
- [ ] Switch de prioridade a quem perde o par-ou-ímpar só quando o formato usa avulso
- [ ] Nome sorteado de `tournamentNames`, com o dado re-sorteando
- [ ] O formato escolhido é gravado no campeonato e o chaveamento passa a ler o formato em vez do `switch` por número de duplas
- [ ] Sem formato `available` para o número de presentes: tela 1j com o aviso, a opção mais próxima com "AJUSTAR PRESENÇA", a planejada em cinza e "INICIAR CAMPEONATO" desabilitado
- [ ] `createTournament` nunca é chamado sem formato disponível
- [ ] Teste: o switch de 3º lugar liga o campo certo e só aparece nos formatos `optional`

## Comments

**2026-10-30** — implementado contra a camada de dados mockada (`core/mock/`), sem backend. Catálogo por número de presentes, variante com o avulso fora, `format_id` gravado, 3º lugar no campo certo e a tela 1j quando não há formato.
