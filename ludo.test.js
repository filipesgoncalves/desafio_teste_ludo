/**
 * Desafio: Ludo, uma partida para 2 jogadores.
 *
 * Toda a regra de negócio do jogo está neste arquivo, junto com os casos de
 * teste. Os testes simulam a partida: lançamento do dado, saída da base,
 * movimento, jogada extra no 6, três 6 seguidos, captura, casas seguras,
 * corredor final, chegada exata e vitória.
 *
 * Regras adotadas:
 *   - Tabuleiro com trilha de 52 casas. Vermelho sai da casa 0 e amarelo da casa 26
 *     (lados opostos, como numa partida de 2 jogadores).
 *   - Cada jogador tem 4 peças, que começam na base.
 *   - Só sai da base quem tira 6; a peça vai para a casa de saída da sua cor.
 *   - Tirou 6, joga de novo. Três 6 seguidos: perde a vez (a terceira jogada não vale).
 *   - Sem movimento possível, a vez passa (se o valor foi 6, o jogador lança de novo).
 *   - Caiu numa casa ocupada por peça adversária, ela volta para a base,
 *     exceto nas casas seguras (saídas e estrelas: 0, 8, 13, 21, 26, 34, 39, 47).
 *   - Duas peças da mesma cor na mesma casa formam uma barreira: o adversário
 *     não pode passar por ela nem parar nela (nem sair da base, se ela estiver na saída dele).
 *     As peças da própria cor passam normalmente.
 *   - Depois de dar a volta (51 passos na trilha), a peça entra no corredor da sua
 *     cor (5 casas, onde ninguém captura) e chega ao centro com o valor exato.
 *   - Vence quem levar as 4 peças ao centro primeiro.
 *
 * Posição de cada peça (progresso): -1 base; 0 a 50 trilha; 51 a 55 corredor; 56 chegada.
 */

// ---------------------------------------------------------------------------
// Regras do jogo
// ---------------------------------------------------------------------------

const BASE = -1;
const CASAS_NA_TRILHA = 52;
const ULTIMA_CASA_DA_TRILHA = 50;
const CHEGADA = 56;
const PECAS_POR_JOGADOR = 4;
const CASAS_SEGURAS = [0, 8, 13, 21, 26, 34, 39, 47];
const CORES = [
  { cor: 'vermelho', saida: 0 },
  { cor: 'amarelo', saida: 26 },
];

/** Gerador pseudoaleatório com semente (mulberry32), para partidas reproduzíveis. */
function criarAleatorio(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Ludo {
  constructor({ nomes = ['Jogador 1', 'Jogador 2'], aleatorio = Math.random } = {}) {
    if (nomes.length !== 2) throw new Error('A partida é para 2 jogadores');
    this.aleatorio = aleatorio;
    this.jogadores = nomes.map((nome, i) => ({
      nome,
      cor: CORES[i].cor,
      saida: CORES[i].saida,
      pecas: Array(PECAS_POR_JOGADOR).fill(BASE),
    }));
    this.vez = 0;
    this.dado = null; // valor lançado que ainda espera um movimento
    this.seisSeguidos = 0;
    this.estado = 'jogando'; // 'jogando' | 'fim'
    this.vencedor = null;
    this.historico = [];
  }

  get jogadorDaVez() {
    return this.jogadores[this.vez];
  }

  /** Casa absoluta da trilha (0 a 51) em que a peça está, ou null se está na base, no corredor ou no centro. */
  casaNaTrilha(indiceJogador, progresso) {
    if (progresso < 0 || progresso > ULTIMA_CASA_DA_TRILHA) return null;
    return (this.jogadores[indiceJogador].saida + progresso) % CASAS_NA_TRILHA;
  }

  /** Verdadeiro se o jogador tem 2 ou mais peças na casa absoluta indicada (barreira). */
  temBarreira(indiceJogador, casa) {
    const pecas = this.jogadores[indiceJogador].pecas;
    return pecas.filter((p) => this.casaNaTrilha(indiceJogador, p) === casa).length >= 2;
  }

  /** Verdadeiro se o caminho de `de` até `para` passa ou para numa barreira adversária. */
  _bloqueadoPorBarreira(de, para) {
    const adversario = 1 - this.vez;
    const inicio = de === BASE ? 0 : de + 1;
    for (let passo = inicio; passo <= Math.min(para, ULTIMA_CASA_DA_TRILHA); passo++) {
      if (this.temBarreira(adversario, this.casaNaTrilha(this.vez, passo))) return true;
    }
    return false;
  }

  /** Índices das peças do jogador da vez que podem andar `valor` casas. */
  movimentosPossiveis(valor = this.dado) {
    if (valor === null) return [];
    return this.jogadorDaVez.pecas
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => {
        if (p === BASE) return valor === 6 && !this._bloqueadoPorBarreira(BASE, 0);
        if (p === CHEGADA) return false;
        if (p + valor > CHEGADA) return false;
        return !this._bloqueadoPorBarreira(p, p + valor);
      })
      .map(({ i }) => i);
  }

  /** Lança o dado. Sem `valor`, sorteia de 1 a 6. */
  lancarDado(valor) {
    this._validarEmAndamento();
    if (this.dado !== null) throw new Error('Mova uma peça antes de lançar o dado de novo');
    if (valor === undefined) valor = 1 + Math.floor(this.aleatorio() * 6);
    if (!Number.isInteger(valor) || valor < 1 || valor > 6) throw new Error('O dado vai de 1 a 6');

    const jogador = this.jogadorDaVez.nome;
    if (valor === 6) {
      this.seisSeguidos++;
      if (this.seisSeguidos === 3) {
        this.historico.push({ jogador, valor, perdeuAVez: true });
        this._passarVez();
        return { valor, movimentos: [], perdeuAVez: true };
      }
    }

    const movimentos = this.movimentosPossiveis(valor);
    if (movimentos.length === 0) {
      this.historico.push({ jogador, valor, semMovimento: true });
      if (valor === 6) return { valor, movimentos, jogaDeNovo: true };
      this._passarVez();
      return { valor, movimentos, passouAVez: true };
    }
    this.dado = valor;
    return { valor, movimentos };
  }

  /** Move a peça escolhida do jogador da vez com o valor do dado lançado. */
  mover(indicePeca) {
    this._validarEmAndamento();
    if (this.dado === null) throw new Error('Lance o dado antes de mover');
    if (!Number.isInteger(indicePeca) || indicePeca < 0 || indicePeca >= PECAS_POR_JOGADOR) {
      throw new Error('Peça inválida: use 0 a 3');
    }
    const valor = this.dado;
    if (!this.movimentosPossiveis(valor).includes(indicePeca)) {
      throw new Error(`A peça ${indicePeca} não pode andar ${valor} casa(s)`);
    }

    const jogador = this.jogadorDaVez;
    const de = jogador.pecas[indicePeca];
    const para = de === BASE ? 0 : de + valor;
    jogador.pecas[indicePeca] = para;

    let capturou = 0;
    const casa = this.casaNaTrilha(this.vez, para);
    if (casa !== null && !CASAS_SEGURAS.includes(casa)) {
      const adversario = 1 - this.vez;
      this.jogadores[adversario].pecas.forEach((q, j) => {
        if (this.casaNaTrilha(adversario, q) === casa) {
          this.jogadores[adversario].pecas[j] = BASE;
          capturou++;
        }
      });
    }

    const resultado = { peca: indicePeca, de, para, casa, capturou, chegou: para === CHEGADA };
    this.historico.push({ jogador: jogador.nome, valor, ...resultado });

    if (jogador.pecas.every((p) => p === CHEGADA)) {
      this.estado = 'fim';
      this.vencedor = jogador.nome;
      this.dado = null;
      return { ...resultado, vitoria: true };
    }

    this.dado = null;
    if (valor !== 6) this._passarVez();
    return resultado;
  }

  /** Monta uma situação de jogo (usado nos testes para chegar direto a um cenário). */
  definirPosicoes(indiceJogador, pecas) {
    if (pecas.length !== PECAS_POR_JOGADOR) throw new Error('Cada jogador tem 4 peças');
    if (pecas.some((p) => !Number.isInteger(p) || p < BASE || p > CHEGADA)) throw new Error('Posição inválida');
    this.jogadores[indiceJogador].pecas = [...pecas];
  }

  _passarVez() {
    this.vez = 1 - this.vez;
    this.seisSeguidos = 0;
    this.dado = null;
  }

  _validarEmAndamento() {
    if (this.estado !== 'jogando') throw new Error('A partida já terminou');
  }
}

// ---------------------------------------------------------------------------
// Auxiliares dos testes
// ---------------------------------------------------------------------------

/** Progresso que uma peça do jogador precisa ter para estar na casa absoluta indicada. */
function progressoPara(jogo, indiceJogador, casa) {
  return (casa - jogo.jogadores[indiceJogador].saida + CASAS_NA_TRILHA) % CASAS_NA_TRILHA;
}

function novaPartida() {
  return new Ludo({ nomes: ['Ana', 'Bruno'] });
}

// ---------------------------------------------------------------------------
// Casos de teste
// ---------------------------------------------------------------------------

describe('Início da partida', () => {
  test('são 2 jogadores, vermelho e amarelo, em lados opostos', () => {
    const jogo = novaPartida();
    expect(jogo.jogadores.map((j) => j.cor)).toEqual(['vermelho', 'amarelo']);
    expect(jogo.jogadores[1].saida - jogo.jogadores[0].saida).toBe(26);
  });

  test('cada jogador começa com 4 peças na base e o vermelho começa', () => {
    const jogo = novaPartida();
    jogo.jogadores.forEach((j) => expect(j.pecas).toEqual([BASE, BASE, BASE, BASE]));
    expect(jogo.jogadorDaVez.nome).toBe('Ana');
  });

  test('partida com outro número de jogadores é recusada', () => {
    expect(() => new Ludo({ nomes: ['A', 'B', 'C'] })).toThrow('2 jogadores');
  });
});

describe('Dado', () => {
  test('valor fora de 1 a 6 é recusado', () => {
    const jogo = novaPartida();
    expect(() => jogo.lancarDado(0)).toThrow('1 a 6');
    expect(() => jogo.lancarDado(7)).toThrow('1 a 6');
    expect(() => jogo.lancarDado(2.5)).toThrow('1 a 6');
  });

  test('o dado sorteado sempre dá de 1 a 6 e todas as faces aparecem', () => {
    const aleatorio = criarAleatorio(10);
    const faces = new Set();
    for (let i = 0; i < 600; i++) {
      const { valor } = new Ludo({ aleatorio }).lancarDado();
      expect(valor).toBeGreaterThanOrEqual(1);
      expect(valor).toBeLessThanOrEqual(6);
      faces.add(valor);
    }
    expect(faces.size).toBe(6);
  });

  test('não se lança o dado de novo antes de mover', () => {
    const jogo = novaPartida();
    jogo.lancarDado(6);
    expect(() => jogo.lancarDado(3)).toThrow('Mova uma peça antes');
  });

  test('não se move peça sem lançar o dado', () => {
    const jogo = novaPartida();
    expect(() => jogo.mover(0)).toThrow('Lance o dado antes de mover');
  });

  test('sem lançar o dado não há movimentos possíveis', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [10, 20, BASE, BASE]);
    expect(jogo.movimentosPossiveis()).toEqual([]);
  });
});

describe('Saída da base', () => {
  test('sem 6, ninguém sai da base e a vez passa', () => {
    const jogo = novaPartida();
    for (const valor of [1, 2, 3, 4, 5]) {
      const vez = jogo.vez;
      expect(jogo.lancarDado(valor)).toEqual({ valor, movimentos: [], passouAVez: true });
      expect(jogo.vez).toBe(1 - vez);
    }
  });

  test('com 6, a peça sai para a casa de saída da sua cor', () => {
    const jogo = novaPartida();
    expect(jogo.lancarDado(6).movimentos).toEqual([0, 1, 2, 3]);
    const r = jogo.mover(2);
    expect(r).toMatchObject({ peca: 2, de: BASE, para: 0, casa: 0 });
    expect(jogo.jogadores[0].pecas).toEqual([BASE, BASE, 0, BASE]);
  });

  test('a peça amarela sai na casa 26', () => {
    const jogo = novaPartida();
    jogo.lancarDado(1); // Ana passa
    jogo.lancarDado(6);
    expect(jogo.mover(0).casa).toBe(26);
  });

  test('peça na base não pode andar com valor diferente de 6', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [10, BASE, BASE, BASE]);
    expect(jogo.lancarDado(3).movimentos).toEqual([0]);
    expect(() => jogo.mover(1)).toThrow('A peça 1 não pode andar 3 casa(s)');
  });
});

describe('Movimento e vez', () => {
  test('a peça anda o valor do dado', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [10, BASE, BASE, BASE]);
    jogo.lancarDado(4);
    expect(jogo.mover(0)).toMatchObject({ de: 10, para: 14, casa: 14 });
  });

  test('depois de um valor diferente de 6, a vez passa', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [10, BASE, BASE, BASE]);
    jogo.lancarDado(4);
    jogo.mover(0);
    expect(jogo.jogadorDaVez.nome).toBe('Bruno');
  });

  test('quem tira 6 joga de novo', () => {
    const jogo = novaPartida();
    jogo.lancarDado(6);
    jogo.mover(0);
    expect(jogo.jogadorDaVez.nome).toBe('Ana');
    jogo.lancarDado(3);
    jogo.mover(0);
    expect(jogo.jogadorDaVez.nome).toBe('Bruno');
    expect(jogo.jogadores[0].pecas[0]).toBe(3);
  });

  test('três 6 seguidos fazem perder a vez', () => {
    const jogo = novaPartida();
    jogo.lancarDado(6);
    jogo.mover(0); // sai da base
    jogo.lancarDado(6);
    jogo.mover(0); // anda 6
    expect(jogo.lancarDado(6)).toEqual({ valor: 6, movimentos: [], perdeuAVez: true });
    expect(jogo.jogadorDaVez.nome).toBe('Bruno');
    expect(jogo.jogadores[0].pecas[0]).toBe(6);
  });

  test('a contagem de 6 seguidos recomeça quando a vez muda', () => {
    const jogo = novaPartida();
    jogo.lancarDado(6);
    jogo.mover(0);
    jogo.lancarDado(6);
    jogo.mover(0);
    jogo.lancarDado(6); // perde a vez
    jogo.lancarDado(6); // Bruno: primeiro 6 dele
    expect(jogo.seisSeguidos).toBe(1);
    jogo.mover(0);
    expect(jogo.jogadorDaVez.nome).toBe('Bruno');
  });

  test('índice de peça inválido é recusado', () => {
    const jogo = novaPartida();
    jogo.lancarDado(6);
    expect(() => jogo.mover(4)).toThrow('Peça inválida');
    expect(() => jogo.mover(-1)).toThrow('Peça inválida');
  });

  test('a peça amarela dá a volta pela casa 51 e continua da casa 0', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(1, [24, BASE, BASE, BASE]); // casa 50
    jogo.lancarDado(1); // Ana passa
    jogo.lancarDado(5);
    expect(jogo.mover(0)).toMatchObject({ para: 29, casa: 3 });
  });
});

describe('Captura e casas seguras', () => {
  test('cair na casa de uma peça adversária a manda de volta para a base', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [10, BASE, BASE, BASE]);
    jogo.definirPosicoes(1, [progressoPara(jogo, 1, 12), 30, BASE, BASE]);
    jogo.lancarDado(2);
    const r = jogo.mover(0);
    expect(r).toMatchObject({ casa: 12, capturou: 1 });
    expect(jogo.jogadores[1].pecas).toEqual([BASE, 30, BASE, BASE]);
  });

  test('o amarelo também captura o vermelho', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [progressoPara(jogo, 0, 30), BASE, BASE, BASE]); // vermelho na casa 30
    jogo.definirPosicoes(1, [2, BASE, BASE, BASE]); // amarelo na casa 28
    jogo.lancarDado(1);
    jogo.mover(0); // Ana: vermelho vai para a casa 31
    jogo.lancarDado(3);
    expect(jogo.mover(0)).toMatchObject({ casa: 31, capturou: 1 });
    expect(jogo.jogadores[0].pecas[0]).toBe(BASE);
  });

  test('duas peças adversárias na mesma casa não são capturadas: formam barreira', () => {
    const jogo = novaPartida();
    const p = progressoPara(jogo, 1, 15);
    jogo.definirPosicoes(0, [10, BASE, BASE, BASE]);
    jogo.definirPosicoes(1, [p, p, BASE, BASE]);
    expect(jogo.temBarreira(1, 15)).toBe(true);
    expect(jogo.lancarDado(5)).toEqual({ valor: 5, movimentos: [], passouAVez: true });
    expect(jogo.jogadores[1].pecas).toEqual([p, p, BASE, BASE]);
  });

  test.each([8, 13, 21, 26, 34, 39, 47])('na casa segura %i ninguém é capturado', (casa) => {
    const jogo = novaPartida();
    const vermelho = progressoPara(jogo, 0, casa) - 2;
    jogo.definirPosicoes(0, [vermelho, BASE, BASE, BASE]);
    jogo.definirPosicoes(1, [progressoPara(jogo, 1, casa), BASE, BASE, BASE]);
    jogo.lancarDado(2);
    expect(jogo.mover(0)).toMatchObject({ casa, capturou: 0 });
    expect(jogo.casaNaTrilha(1, jogo.jogadores[1].pecas[0])).toBe(casa);
  });

  test('sair da base em cima de um adversário na casa de saída não o captura', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(1, [progressoPara(jogo, 1, 0), BASE, BASE, BASE]);
    jogo.lancarDado(6);
    expect(jogo.mover(0)).toMatchObject({ casa: 0, capturou: 0 });
  });

  test('peças da mesma cor podem dividir a mesma casa', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [10, 12, BASE, BASE]);
    jogo.lancarDado(2);
    jogo.mover(0);
    expect(jogo.jogadores[0].pecas).toEqual([12, 12, BASE, BASE]);
  });
});

describe('Barreira', () => {
  /** Amarelo com duas peças na casa 15; vermelho com uma peça na casa 10 e outra na 2. */
  function partidaComBarreira() {
    const jogo = novaPartida();
    const p = progressoPara(jogo, 1, 15);
    jogo.definirPosicoes(0, [10, 2, BASE, BASE]);
    jogo.definirPosicoes(1, [p, p, BASE, BASE]);
    return jogo;
  }

  test('o adversário não pode passar pela barreira', () => {
    const jogo = partidaComBarreira();
    expect(jogo.lancarDado(6).movimentos).not.toContain(0); // 10 + 6 = 16, passaria pela 15
  });

  test('o adversário não pode parar na barreira', () => {
    const jogo = partidaComBarreira();
    expect(jogo.lancarDado(5).movimentos).toEqual([1]); // a peça 0 pararia na 15; a peça 1 vai para a 7
  });

  test('o adversário pode parar antes da barreira', () => {
    const jogo = partidaComBarreira();
    jogo.lancarDado(4);
    expect(jogo.mover(0)).toMatchObject({ casa: 14 });
  });

  test('a barreira também vale numa casa segura', () => {
    const jogo = novaPartida();
    const p = progressoPara(jogo, 1, 13);
    jogo.definirPosicoes(0, [10, BASE, BASE, BASE]);
    jogo.definirPosicoes(1, [p, p, BASE, BASE]);
    expect(jogo.lancarDado(5)).toMatchObject({ movimentos: [], passouAVez: true });
  });

  test('a barreira na casa de saída impede o adversário de sair da base', () => {
    const jogo = novaPartida();
    const p = progressoPara(jogo, 1, 0);
    jogo.definirPosicoes(1, [p, p, BASE, BASE]);
    expect(jogo.lancarDado(6)).toEqual({ valor: 6, movimentos: [], jogaDeNovo: true });
  });

  test('as peças da própria cor passam pela própria barreira', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [10, 12, 12, BASE]);
    jogo.lancarDado(4);
    expect(jogo.mover(0)).toMatchObject({ casa: 14 });
  });

  test('quando uma das peças sai, a barreira se desfaz e a passagem é liberada', () => {
    const jogo = partidaComBarreira();
    jogo.lancarDado(1);
    jogo.mover(1); // Ana: peça 1 vai para a casa 3
    jogo.lancarDado(2);
    jogo.mover(0); // Bruno: uma peça sai da casa 15
    expect(jogo.temBarreira(1, 15)).toBe(false);
    expect(jogo.lancarDado(6).movimentos).toContain(0);
  });
});

describe('Corredor final e chegada', () => {
  test('depois da casa 50 do seu percurso, a peça entra no corredor e sai da trilha', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [48, BASE, BASE, BASE]);
    jogo.lancarDado(5);
    expect(jogo.mover(0)).toMatchObject({ para: 53, casa: null });
  });

  test('no corredor a peça não pode ser capturada', () => {
    const jogo = novaPartida();
    // vermelho no corredor (progresso 55); se estivesse na trilha, seria a casa 3
    jogo.definirPosicoes(0, [55, BASE, BASE, BASE]);
    jogo.definirPosicoes(1, [progressoPara(jogo, 1, 1), BASE, BASE, BASE]); // amarelo na casa 1
    jogo.lancarDado(3); // Ana não tem movimento e passa
    jogo.lancarDado(2);
    expect(jogo.mover(0)).toMatchObject({ casa: 3, capturou: 0 });
    expect(jogo.jogadores[0].pecas[0]).toBe(55);
  });

  test('chegar ao centro exige o valor exato', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [54, BASE, BASE, BASE]);
    expect(jogo.lancarDado(3)).toEqual({ valor: 3, movimentos: [], passouAVez: true });
    jogo.lancarDado(1); // Bruno passa
    jogo.lancarDado(2);
    expect(jogo.mover(0)).toMatchObject({ para: CHEGADA, chegou: true });
  });

  test('peça que chegou ao centro não anda mais', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [CHEGADA, 10, BASE, BASE]);
    expect(jogo.lancarDado(1).movimentos).toEqual([1]);
  });

  test('com 6 e nenhum movimento possível, o jogador lança de novo', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [53, 54, 55, CHEGADA]);
    expect(jogo.lancarDado(6)).toEqual({ valor: 6, movimentos: [], jogaDeNovo: true });
    expect(jogo.jogadorDaVez.nome).toBe('Ana');
    expect(jogo.lancarDado(1).movimentos).toEqual([0, 1, 2]);
  });
});

describe('Vitória', () => {
  test('quem leva as 4 peças ao centro vence', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [CHEGADA, CHEGADA, CHEGADA, 55]);
    jogo.lancarDado(1);
    expect(jogo.mover(3)).toMatchObject({ chegou: true, vitoria: true });
    expect(jogo.estado).toBe('fim');
    expect(jogo.vencedor).toBe('Ana');
  });

  test('3 peças no centro ainda não é vitória', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(0, [CHEGADA, CHEGADA, CHEGADA, 50]);
    jogo.lancarDado(1);
    jogo.mover(3);
    expect(jogo.estado).toBe('jogando');
  });

  test('depois do fim nenhuma jogada é aceita', () => {
    const jogo = novaPartida();
    jogo.definirPosicoes(1, [CHEGADA, CHEGADA, CHEGADA, 50]);
    jogo.lancarDado(1); // Ana passa
    jogo.lancarDado(6);
    jogo.mover(3);
    expect(jogo.vencedor).toBe('Bruno');
    expect(() => jogo.lancarDado(3)).toThrow('A partida já terminou');
    expect(() => jogo.mover(0)).toThrow('A partida já terminou');
  });
});

describe('Partida simulada', () => {
  /** Estratégia simples: captura se puder; senão tira peça da base; senão anda a peça mais adiantada. */
  function escolherPeca(jogo, movimentos) {
    const pecas = jogo.jogadorDaVez.pecas;
    const adversario = 1 - jogo.vez;
    const captura = movimentos.find((i) => {
      const para = pecas[i] === BASE ? 0 : pecas[i] + jogo.dado;
      const casa = jogo.casaNaTrilha(jogo.vez, para);
      return (
        casa !== null &&
        !CASAS_SEGURAS.includes(casa) &&
        jogo.jogadores[adversario].pecas.some((q) => jogo.casaNaTrilha(adversario, q) === casa)
      );
    });
    if (captura !== undefined) return captura;
    const daBase = movimentos.find((i) => pecas[i] === BASE);
    if (daBase !== undefined) return daBase;
    return movimentos.reduce((melhor, i) => (pecas[i] > pecas[melhor] ? i : melhor));
  }

  test.each([1, 2, 3, 7, 42, 2026])('partida sorteada vai até o fim com um vencedor (semente %i)', (semente) => {
    const jogo = new Ludo({ nomes: ['Ana', 'Bruno'], aleatorio: criarAleatorio(semente) });
    let lancamentos = 0;
    while (jogo.estado === 'jogando') {
      const { movimentos } = jogo.lancarDado();
      if (movimentos.length) jogo.mover(escolherPeca(jogo, movimentos));
      lancamentos++;
      if (lancamentos > 5000) throw new Error('A partida não terminou');
      for (const j of jogo.jogadores) {
        expect(j.pecas).toHaveLength(4);
        j.pecas.forEach((p) => expect(p >= BASE && p <= CHEGADA).toBe(true));
      }
    }
    const vencedor = jogo.jogadores.find((j) => j.nome === jogo.vencedor);
    const perdedor = jogo.jogadores.find((j) => j.nome !== jogo.vencedor);
    expect(vencedor.pecas).toEqual([CHEGADA, CHEGADA, CHEGADA, CHEGADA]);
    expect(perdedor.pecas.every((p) => p === CHEGADA)).toBe(false);
    expect(jogo.historico.length).toBeGreaterThan(0);
  });
});
