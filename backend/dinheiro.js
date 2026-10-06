// =============================================================================
// Conta de dinheiro.
//
// O problema: em JavaScript (e em qualquer linguagem com ponto flutuante),
// 0.1 + 0.2 nao da 0.3, da 0.30000000000000004. Numeros com casas decimais sao
// guardados em base 2, e 0,1 em base 2 e uma dizima -- igual a 1/3 em base 10.
//
// Isso nao e detalhe academico aqui: as regras de pagamento desta fase comparam
// valores por igualdade exata. A RN0034 pergunta "este cartao tem pelo menos
// R$ 10,00?" e a soma dos pagamentos tem que bater EXATAMENTE com o total da
// compra. Um centavo de erro acumulado reprovaria uma compra correta.
//
// A solucao: toda comparacao e toda soma acontece em CENTAVOS, que sao numeros
// inteiros. 10,00 vira 1000. Inteiro em JavaScript e exato ate 9 quatrilhoes,
// muito alem de qualquer compra. Converte-se de volta para reais so na hora de
// gravar no banco e de mostrar na tela.
// =============================================================================

/**
 * Converte reais para centavos (1 numero inteiro).
 *
 * O Math.round e indispensavel: 35.35 * 100 da 3534.9999999999995 em ponto
 * flutuante, e sem arredondar virariam 3534 centavos -- um centavo perdido.
 */
function emCentavos(valorEmReais) {
    return Math.round(Number(valorEmReais || 0) * 100);
}

/** Converte centavos de volta para reais, com 2 casas decimais. */
function emReais(valorEmCentavos) {
    return valorEmCentavos / 100;
}

/** Formata para exibicao e para mensagens de erro: 1050 -> "R$ 10,50". */
function formatar(valorEmCentavos) {
    return 'R$ ' + emReais(valorEmCentavos).toFixed(2).replace('.', ',');
}

module.exports = { emCentavos, emReais, formatar };
