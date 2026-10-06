// =============================================================================
// GET /api/produtos -- o catalogo da loja.
//
// So de leitura, igual ao de bandeiras. O cadastro de produto (RF0011 a RF0016)
// e a entrada em estoque (RF0051) sao de outra fase do DRS: os produtos desta
// fase entram pelo seed.sql, que e o que o enunciado pede ("os cadastros
// necessarios para a demonstracao devem existir previamente na base").
//
// Por isso aqui nao existe POST, PUT nem DELETE.
// =============================================================================

const express = require('express');
const { consultar } = require('./db');

const rotas = express.Router();

rotas.get('/', async (requisicao, resposta) => {
    // Devolvemos quantidade_estoque junto porque a tela precisa dela para duas
    // coisas: limitar o seletor de quantidade e marcar o produto como esgotado.
    // E a RN0031 aparecendo na interface, antes mesmo de o servidor recusar.
    //
    // Produtos inativos nao aparecem na loja -- mesmo padrao de soft delete do
    // cliente: o registro continua no banco, so nao e mais oferecido.
    const produtos = await consultar(
        `SELECT id, nome, categoria, descricao, preco, quantidade_estoque, icone, imagem
           FROM tb_produto
          WHERE ativo = TRUE
          ORDER BY id`
    );

    resposta.json(produtos.map((linha) => ({
        id: linha.id,
        nome: linha.nome,
        categoria: linha.categoria,
        descricao: linha.descricao,
        preco: linha.preco,
        quantidadeEstoque: linha.quantidade_estoque,
        // 'icone' continua indo junto: e a reserva de quando a imagem nao
        // carrega, e e o que o carrinho usa nas linhas da tabela.
        icone: linha.icone,
        imagem: linha.imagem
    })));
});

module.exports = rotas;
