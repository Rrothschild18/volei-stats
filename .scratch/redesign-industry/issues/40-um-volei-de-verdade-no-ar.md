# 40: Um vôlei de verdade, do começo ao fim, no ar

**What to build:** O caminho inteiro no **site publicado**, com dois aparelhos
de verdade: criar o vôlei, cadastrar o pessoal, mandar o código, o segundo
aparelho entrar e dizer quem é, marcar presença, sortear, escolher o formato,
lançar placar, **corrigir um placar**, e ver a classificação e os rankings.

**Blocked by:** 39 (os commits em produção)

**Status:** ready-for-agent

## Por que isto não é redundante com os testes

Os e2e rodam contra o Supabase local, com seed, num navegador só e sem latência.
Produção é outro banco, outra RLS instanciada, outro domínio, dois aparelhos
reais, e uma rede que às vezes some. Build verde prova que compila; isto prova
que funciona.

E há uma coisa que só aqui dá para ver: **a correção de placar** atravessa
`correct_match_score`, que é `security definer` e nasceu neste mês. Na nuvem ela
nunca rodou — a migration subiu, mas subir não é rodar.

## O que olhar com atenção

- A correção de placar: ela apaga partidas por dentro. Conferir que o que sai é
  só o que o resultado novo derrubou, e que a chave **volta a andar** (é o que o
  ticket 35 descobriu que ninguém testava).
- A regra do placar vinda do banco: `18 × 3` num campeonato de 12 tem de ser
  recusado mesmo que a tela deixasse passar.
- O prazo de 30 min: o botão de corrigir sai da tela, e uma aba velha que tente
  mesmo assim é recusada pelo banco.

- [ ] Vôlei criado em produção, com o pessoal cadastrado
- [ ] Segundo aparelho entra pelo código e diz quem é
- [ ] Sessão, presença, sorteio e formato até a chave ao vivo
- [ ] Placar lançado, e travado para o segundo lançamento
- [ ] Placar corrigido do outro aparelho, com o nome de quem corrigiu na tela
- [ ] Classificação e rankings coerentes com o que foi jogado
- [ ] Nenhum erro no console que o app não tenha dito em português na tela
