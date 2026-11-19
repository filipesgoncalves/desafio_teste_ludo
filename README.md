# desafio_teste_ludo

Casos de teste em JavaScript (Jest) que simulam uma partida de **Ludo** para 2 jogadores. Toda a regra de negócio do jogo está dentro do próprio arquivo de teste, [`ludo.test.js`](ludo.test.js): a partida acontece só pelos testes.

## Especificação do desafio

> Ludo (by Vini)
> - casos de teste para testar uma partida para 02 jogadores;
> - casos de teste em Javascript para testar Javascript.

## Regras implementadas

- Trilha de 52 casas. Vermelho sai da casa 0 e amarelo da casa 26 (lados opostos).
- Cada jogador tem 4 peças, que começam na base. O vermelho joga primeiro.
- Só sai da base quem tira 6. A peça vai para a casa de saída da sua cor.
- Quem tira 6 joga de novo. Três 6 seguidos fazem perder a vez (a terceira jogada não vale).
- Sem movimento possível, a vez passa. Se o valor foi 6, o jogador lança de novo.
- **Captura**: a peça que cai numa casa ocupada por peça adversária manda essa peça de volta para a base (todas, se houver mais de uma). Peças da mesma cor podem dividir a casa.
- **Casas seguras**: saídas e estrelas (0, 8, 13, 21, 26, 34, 39 e 47). Nelas ninguém é capturado.
- **Corredor final**: depois de 51 passos na trilha, a peça entra no corredor da sua cor (5 casas), onde não pode ser capturada, e chega ao centro só com o valor exato.
- Vence quem levar as 4 peças ao centro primeiro. Depois do fim, nenhuma jogada é aceita.

Posição de cada peça (progresso): `-1` base, `0` a `50` trilha, `51` a `55` corredor, `56` chegada.

## Como executar

Requer Node.js 18 ou superior.

```bash
npm install
npm test
```

## Funcionamento dos casos de teste

O arquivo tem três partes:

1. **Regras do jogo**: a classe `Ludo` (dado, movimentos possíveis, movimento, captura, vez e vitória) e um gerador aleatório com semente (`criarAleatorio`). O dado pode ser sorteado ou informado, para que os testes controlem cada lance.
2. **Auxiliares**: `definirPosicoes` monta uma situação de jogo direto (por exemplo, uma peça prestes a chegar) e `progressoPara` calcula onde pôr uma peça para que ela fique numa casa da trilha.
3. **Casos de teste**, agrupados assim:

| Grupo | O que verifica |
|---|---|
| Início da partida | 2 jogadores em lados opostos, 4 peças na base, vermelho começa, outro número de jogadores recusado |
| Dado | Valores de 1 a 6, todas as faces aparecem, não se lança de novo antes de mover, não se move sem lançar |
| Saída da base | Sem 6 a vez passa, com 6 a peça vai para a saída (casa 0 ou 26), peça na base não anda com outro valor |
| Movimento e vez | A peça anda o valor do dado, a vez passa sem 6, com 6 joga de novo, três 6 seguidos perdem a vez, a contagem recomeça na troca de vez, índice inválido, volta pela casa 51 |
| Captura e casas seguras | Captura nos dois sentidos, duas peças capturadas de uma vez, nenhuma captura nas 7 casas seguras nem na saída, peças da mesma cor dividem a casa |
| Corredor final e chegada | Entrada no corredor, peça no corredor não é capturada, chegada com valor exato, peça no centro não anda, 6 sem movimento lança de novo |
| Vitória | 4 peças no centro vencem, 3 ainda não, nada é aceito depois do fim |
| Partida simulada | Partidas sorteadas jogadas até o fim com uma estratégia simples, conferindo a cada lance as posições válidas e, no fim, o vencedor |

Cada teste monta a própria partida, lança o dado, move as peças e confere as posições, a vez, as capturas e o vencedor.

## Colaborador

- Filipe ([filipesgoncalves](https://github.com/filipesgoncalves))
