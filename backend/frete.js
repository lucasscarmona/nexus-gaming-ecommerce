// =============================================================================
// RF0034 - Calculo do frete.
//
// O DRS exige que o frete seja calculado "com base nos itens selecionados e o
// endereco apontado pelo cliente", mas NAO define a formula. O criterio abaixo
// foi escolhido por nos, e e este:
//
//     frete = taxa da regiao do estado de entrega + (R$ 4,00 x quantidade de itens)
//
// Por que este criterio:
//   - usa as DUAS coisas que o RF0034 manda usar: o endereco (atraves do
//     estado) e os itens selecionados (atraves da quantidade);
//   - a taxa por regiao representa a distancia ate o centro de distribuicao,
//     que fica em Sao Paulo -- quanto mais longe, mais caro;
//   - o valor por item representa o volume da encomenda: dois teclados ocupam
//     o dobro de uma caixa e custam mais para transportar.
//
// Peso nao entra na conta porque o cadastro de produto desta fase nao tem peso
// (o cadastro completo, RF0011, e de outra fase do DRS). Quantidade de itens e
// a melhor aproximacao de volume disponivel hoje.
//
// Este arquivo existe separado, e nao dentro das rotas, para ser facil de achar
// e de mostrar: toda a regra de frete do sistema esta nestas linhas.
// =============================================================================

// Taxa base por regiao, em reais. O centro de distribuicao fica em SP, por isso
// SP e a taxa mais barata e a distancia cresce dali.
const TAXA_POR_REGIAO = {
    SP: 10.00,                                          // mesmo estado do centro de distribuicao
    RJ: 18.00, MG: 18.00, ES: 18.00,                    // Sudeste
    PR: 22.00, SC: 22.00, RS: 22.00,                    // Sul
    GO: 28.00, MT: 28.00, MS: 28.00, DF: 28.00,         // Centro-Oeste
    BA: 32.00, SE: 32.00, AL: 32.00, PE: 32.00,         // Nordeste
    PB: 32.00, RN: 32.00, CE: 32.00, PI: 32.00, MA: 32.00,
    AC: 38.00, AM: 38.00, RO: 38.00, RR: 38.00,         // Norte
    PA: 38.00, AP: 38.00, TO: 38.00
};

const VALOR_POR_ITEM = 4.00;

// Estado nao reconhecido cai na taxa mais cara. E a escolha segura: melhor
// cobrar a mais de um estado digitado errado do que entregar de graca.
const TAXA_PADRAO = 38.00;

/**
 * Calcula o frete de uma entrega.
 *
 * @param estado            sigla de 2 letras do estado de entrega (ex.: 'SP')
 * @param quantidadeDeItens soma das quantidades de todos os itens do carrinho
 *                          (3 teclados + 2 mouses = 5)
 * @returns o valor do frete em reais
 */
function calcular(estado, quantidadeDeItens) {
    const sigla = String(estado || '').trim().toUpperCase();
    const taxaDaRegiao = TAXA_POR_REGIAO[sigla] ?? TAXA_PADRAO;
    return taxaDaRegiao + (VALOR_POR_ITEM * quantidadeDeItens);
}

module.exports = { calcular, TAXA_POR_REGIAO, VALOR_POR_ITEM };
