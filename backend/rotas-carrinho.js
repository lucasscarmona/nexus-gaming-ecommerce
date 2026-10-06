// =============================================================================
// RF0031 / RF0032 - carrinho de compra.
//
//   GET    /api/carrinho/:clienteId                 ver os itens  (RF0031)
//   POST   /api/carrinho/:clienteId                 adicionar     (RF0031/RF0032)
//   PUT    /api/carrinho/:clienteId/itens/:itemId   alterar qtd   (RF0032)
//   DELETE /api/carrinho/:clienteId/itens/:itemId   excluir       (RF0031)
//
// Este e o unico DELETE de verdade do sistema, e e proposital. O cliente usa
// soft delete (RF0023) porque apagar um cliente levaria embora o historico de
// compras dele. O carrinho e o oposto: o proprio RF0031 o chama de "repositorio
// temporario". Um item removido do carrinho nunca foi uma compra, entao nao ha
// historico nenhum a preservar.
//
// Fora do escopo desta fase: o bloqueio temporario de estoque e a expiracao dos
// itens do carrinho (RN0032, RN0044, RN0045 e RNF0042).
// =============================================================================

const express = require('express');

const { consultar } = require('./db');
const validacao = require('./validacao');
const auditoria = require('./auditoria');
const { emCentavos, emReais } = require('./dinheiro');

const { erroDeRegra } = validacao;
const rotas = express.Router();

/**
 * Le os itens do carrinho de um cliente, ja com os dados do produto.
 *
 * Exportada porque o rotas-pedidos.js tambem precisa dela: a finalizacao da
 * compra transforma exatamente estes itens em itens do pedido. Ter a consulta
 * em um lugar so garante que a tela do carrinho e a compra enxerguem sempre a
 * mesma coisa.
 */
async function buscarItensDoCarrinho(clienteId) {
    const linhas = await consultar(
        `SELECT i.id, i.quantidade, i.produto_id,
                p.nome, p.categoria, p.icone, p.preco, p.quantidade_estoque
           FROM tb_carrinho_item i
           JOIN tb_produto p ON p.id = i.produto_id
          WHERE i.cliente_id = $1
          ORDER BY i.id`,
        [clienteId]
    );

    return linhas.map((linha) => ({
        id: linha.id,
        produtoId: linha.produto_id,
        nome: linha.nome,
        categoria: linha.categoria,
        icone: linha.icone,
        precoUnitario: linha.preco,
        quantidade: linha.quantidade,
        quantidadeEstoque: linha.quantidade_estoque,
        // Subtotal da linha calculado em centavos e devolvido em reais, para
        // nao arrastar erro de ponto flutuante ate o total da compra.
        subtotal: emReais(emCentavos(linha.preco) * linha.quantidade)
    }));
}

/** Monta a resposta do carrinho: os itens mais os totais que a tela exibe. */
function respostaDoCarrinho(itens) {
    const subtotalEmCentavos = itens.reduce(
        (soma, item) => soma + emCentavos(item.precoUnitario) * item.quantidade, 0);

    return {
        itens,
        // Soma das QUANTIDADES, nao do numero de linhas: 3 teclados e 2 mouses
        // sao 5 itens. E este numero que o frete usa (RF0034).
        quantidadeTotalDeItens: itens.reduce((soma, item) => soma + item.quantidade, 0),
        subtotal: emReais(subtotalEmCentavos)
    };
}

/** O id na URL e texto; se nao for um inteiro positivo, o registro nao existe. */
function idDaUrl(valor, mensagemSeInvalido) {
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero <= 0) throw erroDeRegra(mensagemSeInvalido);
    return numero;
}

async function exigirCliente(clienteId) {
    const linhas = await consultar('SELECT id FROM tb_cliente WHERE id = $1', [clienteId]);
    if (linhas.length === 0) throw erroDeRegra('Cliente não encontrado.');
}

/**
 * RN0031 - valida o estoque antes de deixar o item entrar no carrinho.
 *
 * Duas checagens diferentes, porque o requisito pede as duas:
 *   1. o produto precisa ESTAR disponivel (existe, ativo, com estoque > 0);
 *   2. a quantidade pedida nao pode passar do que existe em estoque.
 *
 * @param quantidadeDesejada quantidade TOTAL que ficara no carrinho depois da
 *                           operacao -- nao o quanto esta sendo somado agora.
 *                           Sem isso, adicionar 3 e depois mais 3 de um produto
 *                           com 5 em estoque passaria duas vezes pela validacao
 *                           e deixaria 6 no carrinho.
 */
async function exigirEstoque(produtoId, quantidadeDesejada) {
    const linhas = await consultar(
        'SELECT nome, quantidade_estoque, ativo FROM tb_produto WHERE id = $1',
        [produtoId]
    );
    if (linhas.length === 0) throw erroDeRegra('Produto não encontrado.');

    const produto = linhas[0];
    if (!produto.ativo || produto.quantidade_estoque <= 0) {
        throw erroDeRegra('O produto ' + produto.nome + ' não está disponível em estoque.');
    }
    if (quantidadeDesejada > produto.quantidade_estoque) {
        throw erroDeRegra(
            'Quantidade indisponível: há apenas ' + produto.quantidade_estoque +
            ' unidade(s) de ' + produto.nome + ' em estoque.'
        );
    }
    return produto;
}

// =============================================================================
// RF0031 - Visualizar os itens do carrinho
// =============================================================================
rotas.get('/:clienteId', async (requisicao, resposta) => {
    const clienteId = idDaUrl(requisicao.params.clienteId, 'Cliente não encontrado.');
    await exigirCliente(clienteId);

    resposta.json(respostaDoCarrinho(await buscarItensDoCarrinho(clienteId)));
});

// =============================================================================
// RF0031 / RF0032 / RN0031 - Adicionar um item ao carrinho
//
// A quantidade vem no corpo da requisicao, e nao fixa em 1: e o RF0032 pedindo
// que a quantidade possa ser definida ja no momento da adicao.
// =============================================================================
rotas.post('/:clienteId', async (requisicao, resposta) => {
    const clienteId = idDaUrl(requisicao.params.clienteId, 'Cliente não encontrado.');
    const dados = requisicao.body;

    validacao.validarItemDeCarrinho(dados);
    await exigirCliente(clienteId);

    const produtoId = Number(dados.produtoId);
    const quantidade = Number(dados.quantidade);

    // Se o produto ja esta no carrinho, a nova quantidade se SOMA a que ja
    // estava. O estoque e validado contra o total resultante, nao contra o que
    // esta entrando agora.
    const jaNoCarrinho = await consultar(
        'SELECT quantidade FROM tb_carrinho_item WHERE cliente_id = $1 AND produto_id = $2',
        [clienteId, produtoId]
    );
    const quantidadeFinal = (jaNoCarrinho[0]?.quantidade || 0) + quantidade;

    await exigirEstoque(produtoId, quantidadeFinal);

    // ON CONFLICT ... DO UPDATE: se a linha (cliente, produto) ja existe, o
    // Postgres atualiza a quantidade em vez de recusar o INSERT pelo UNIQUE.
    // Resolve inserir-ou-atualizar em um comando so, sem IF no codigo.
    const salvos = await consultar(
        `INSERT INTO tb_carrinho_item (cliente_id, produto_id, quantidade)
         VALUES ($1, $2, $3)
         ON CONFLICT (cliente_id, produto_id)
         DO UPDATE SET quantidade = $3
         RETURNING id`,
        [clienteId, produtoId, quantidadeFinal]
    );

    await auditoria.registrar(
        'CarrinhoItem', salvos[0].id, 'CRIACAO', 'cliente-' + clienteId,
        'Item adicionado ao carrinho (RF0031)'
    );

    resposta.status(201).json(respostaDoCarrinho(await buscarItensDoCarrinho(clienteId)));
});

// =============================================================================
// RF0032 / RN0031 - Alterar a quantidade de um item ja no carrinho
//
// Aqui a quantidade SUBSTITUI a anterior (na adicao ela soma). E a segunda
// metade do RF0032: editar a quantidade na visualizacao dos itens.
// =============================================================================
rotas.put('/:clienteId/itens/:itemId', async (requisicao, resposta) => {
    const clienteId = idDaUrl(requisicao.params.clienteId, 'Cliente não encontrado.');
    const itemId = idDaUrl(requisicao.params.itemId, 'Item não encontrado no carrinho.');

    validacao.validarQuantidade(requisicao.body);
    const quantidade = Number(requisicao.body.quantidade);

    // O "AND cliente_id" impede que um cliente altere o carrinho de outro
    // trocando o numero na URL.
    const itens = await consultar(
        'SELECT produto_id FROM tb_carrinho_item WHERE id = $1 AND cliente_id = $2',
        [itemId, clienteId]
    );
    if (itens.length === 0) throw erroDeRegra('Item não encontrado no carrinho.');

    await exigirEstoque(itens[0].produto_id, quantidade);

    await consultar(
        'UPDATE tb_carrinho_item SET quantidade = $1 WHERE id = $2',
        [quantidade, itemId]
    );

    await auditoria.registrar(
        'CarrinhoItem', itemId, 'ALTERACAO', 'cliente-' + clienteId,
        'Quantidade do item alterada no carrinho (RF0032)'
    );

    resposta.json(respostaDoCarrinho(await buscarItensDoCarrinho(clienteId)));
});

// =============================================================================
// RF0031 - Excluir um item do carrinho
// =============================================================================
rotas.delete('/:clienteId/itens/:itemId', async (requisicao, resposta) => {
    const clienteId = idDaUrl(requisicao.params.clienteId, 'Cliente não encontrado.');
    const itemId = idDaUrl(requisicao.params.itemId, 'Item não encontrado no carrinho.');

    const removidos = await consultar(
        'DELETE FROM tb_carrinho_item WHERE id = $1 AND cliente_id = $2 RETURNING id',
        [itemId, clienteId]
    );
    if (removidos.length === 0) throw erroDeRegra('Item não encontrado no carrinho.');

    await auditoria.registrar(
        'CarrinhoItem', itemId, 'EXCLUSAO', 'cliente-' + clienteId,
        'Item removido do carrinho (RF0031)'
    );

    resposta.json(respostaDoCarrinho(await buscarItensDoCarrinho(clienteId)));
});

// Exporta o router E a leitura do carrinho, que o rotas-pedidos.js reaproveita.
module.exports = { rotas, buscarItensDoCarrinho };
