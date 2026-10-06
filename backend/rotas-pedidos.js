// =============================================================================
// RF0033 a RF0038 - realizar e finalizar a compra.
//
//   GET  /api/pedidos/:clienteId/frete?estado=SP   previa do frete  (RF0034)
//   GET  /api/pedidos/:clienteId/cupons            cupons do cliente
//   POST /api/pedidos/:clienteId                   finalizar compra (RF0033/RF0038)
//   GET  /api/pedidos/:clienteId                   pedidos do cliente
//
// As quatro regras de pagamento do DRS estao neste arquivo, cada uma em sua
// funcao, com o ID do requisito no nome da secao:
//   RN0033 - apenas um cupom promocional por compra
//   RN0034 - minimo de R$ 10,00 por cartao
//   RN0035 - cartao abaixo de R$ 10,00 so quando ha cupons
//   RN0036 - cupom de troca do troco, sem permitir cupom desnecessario
//
// Fora do escopo desta fase: validacao da operadora e mudanca de status apos a
// finalizacao (RN0037, RN0038, RF0039, RF0040), e a baixa em estoque (RF0053,
// RN0028). Por isso o pedido nasce e permanece EM PROCESSAMENTO.
// =============================================================================

const express = require('express');

const { consultar, pool } = require('./db');
const validacao = require('./validacao');
const auditoria = require('./auditoria');
const frete = require('./frete');
const { buscarItensDoCarrinho } = require('./rotas-carrinho');
const { emCentavos, emReais, formatar } = require('./dinheiro');

const { erroDeRegra } = validacao;
const rotas = express.Router();

// RN0034 - valor minimo que pode ser cobrado em um cartao, em centavos.
const MINIMO_POR_CARTAO = emCentavos(10.00);

// RF0038 - todo pedido finalizado nasce com este status.
const STATUS_INICIAL = 'EM PROCESSAMENTO';

// -----------------------------------------------------------------------------
// Auxiliares
// -----------------------------------------------------------------------------

function idDaUrl(valor, mensagemSeInvalido) {
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero <= 0) throw erroDeRegra(mensagemSeInvalido);
    return numero;
}

async function exigirCliente(clienteId) {
    const linhas = await consultar('SELECT id FROM tb_cliente WHERE id = $1', [clienteId]);
    if (linhas.length === 0) throw erroDeRegra('Cliente não encontrado.');
}

/** RN0025 - a bandeira do cartao novo tem que existir na tabela de dominio. */
async function exigirBandeira(nome) {
    const linhas = await consultar(
        'SELECT id, nome FROM tb_bandeira WHERE LOWER(nome) = LOWER($1)',
        [nome || '']
    );
    if (linhas.length === 0) throw erroDeRegra('Bandeira de cartão não registrada no sistema.');
    return linhas[0];
}

/** Os 4 ultimos digitos, para identificar o cartao sem expor o numero. */
function finalDoCartao(numero) {
    const texto = String(numero || '');
    return texto.length >= 4 ? texto.slice(-4) : '????';
}

// =============================================================================
// RN0033 / RN0036 - carregar e validar os cupons informados
// =============================================================================

/**
 * Busca os cupons pelos codigos e recusa o que nao pode ser usado.
 *
 * Tres motivos para recusar, nesta ordem:
 *   1. o codigo nao existe;
 *   2. o cupom ja foi usado em outra compra (todo cupom e de uso unico);
 *   3. e um cupom de troca de OUTRO cliente -- cupom de troca e dinheiro que
 *      pertence a quem devolveu o produto, nao vale para qualquer um. Cupom
 *      promocional (cliente_id NULL) e campanha da loja e vale para todos.
 */
async function carregarCupons(clienteId, codigosInformados) {
    if (codigosInformados.length === 0) return [];

    const codigos = codigosInformados.map((codigo) => String(codigo).trim().toUpperCase());

    // Set guarda valores sem repetir: se o tamanho mudou, veio codigo duplicado.
    // Sem esta checagem o cliente poderia somar o mesmo cupom duas vezes.
    if (new Set(codigos).size !== codigos.length) {
        throw erroDeRegra('O mesmo cupom foi informado mais de uma vez.');
    }

    const encontrados = await consultar(
        `SELECT id, codigo, tipo, valor, cliente_id, usado
           FROM tb_cupom
          WHERE UPPER(codigo) = ANY($1)`,
        [codigos]
    );

    // Percorremos os codigos PEDIDOS, e nao os encontrados, para conseguir dizer
    // qual codigo especifico nao existe.
    return codigos.map((codigo) => {
        const cupom = encontrados.find((linha) => linha.codigo.toUpperCase() === codigo);
        if (!cupom) throw erroDeRegra('Cupom ' + codigo + ' não encontrado.');
        if (cupom.usado) throw erroDeRegra('O cupom ' + cupom.codigo + ' já foi utilizado.');
        if (cupom.tipo === 'TROCA' && cupom.cliente_id !== clienteId) {
            throw erroDeRegra('O cupom de troca ' + cupom.codigo + ' não pertence a este cliente.');
        }
        return cupom;
    });
}

/**
 * Aplica as regras de cupom e devolve quanto eles somam, em centavos.
 */
function validarRegrasDeCupons(cupons, totalEmCentavos) {
    // --- RN0033: apenas um cupom promocional por compra -----------------------
    // Nao ha limite para cupons de troca: eles sao dinheiro do proprio cliente,
    // devolvido por produtos que ele comprou. O limite e so para o promocional,
    // que e desconto dado pela loja.
    const promocionais = cupons.filter((cupom) => cupom.tipo === 'PROMOCIONAL');
    if (promocionais.length > 1) {
        throw erroDeRegra('Apenas um cupom promocional pode ser utilizado por compra (RN0033).');
    }

    const somaEmCentavos = cupons.reduce(
        (soma, cupom) => soma + emCentavos(cupom.valor), 0);

    // --- RN0036: nenhum cupom pode ser desnecessario --------------------------
    // A regra: se dá para tirar um cupom e os que sobram AINDA cobrem a compra,
    // aquele cupom nao era necessario e a compra e recusada.
    //
    // O exemplo do DRS: compra de R$ 50,00 e cupons de R$ 20,00, R$ 40,00 e
    // R$ 35,00. Usando os tres (R$ 95,00), tirar o de R$ 20,00 deixa R$ 75,00,
    // que ainda cobre os R$ 50,00 -- logo o de R$ 20,00 sobrava. Ja com dois
    // quaisquer a conta fecha: tirar qualquer um deles derruba o total abaixo
    // de R$ 50,00, entao os dois sao necessarios.
    //
    // Quando os cupons nao cobrem a compra toda (vao ser completados por
    // cartao), a condicao abaixo nunca e verdadeira -- tirar um cupom so afasta
    // mais ainda do total. Ou seja: a regra se aplica sozinha, sem precisar de
    // um "se" em volta.
    for (const cupom of cupons) {
        const somaSemEle = somaEmCentavos - emCentavos(cupom.valor);
        if (somaSemEle >= totalEmCentavos) {
            throw erroDeRegra(
                'O cupom ' + cupom.codigo + ' é desnecessário: os demais cupons já cobrem ' +
                'o valor da compra (RN0036).'
            );
        }
    }

    return somaEmCentavos;
}

// =============================================================================
// RN0034 / RN0035 - regras dos cartoes de credito
// =============================================================================

/**
 * @param restanteEmCentavos quanto falta pagar depois de descontados os cupons
 * @param usouCupons         se algum cupom entrou no pagamento
 */
function validarRegrasDeCartoes(cartoes, restanteEmCentavos, usouCupons) {
    // Os cupons ja cobriram tudo: cartao nenhum e necessario.
    if (restanteEmCentavos <= 0) {
        if (cartoes.length > 0) {
            throw erroDeRegra('Os cupons já cobrem o valor da compra; não informe cartão de crédito.');
        }
        return;
    }

    if (cartoes.length === 0) {
        throw erroDeRegra('É necessário informar ao menos um cartão para pagar ' +
            formatar(restanteEmCentavos) + '.');
    }

    // A soma tem que BATER EXATAMENTE. Nem a menos (ficaria faltando pagar) nem
    // a mais (estariamos cobrando do cliente mais do que a compra). A conta e em
    // centavos justamente para que "exatamente" signifique exatamente.
    const somaDosCartoes = cartoes.reduce(
        (soma, pagamento) => soma + emCentavos(pagamento.valor), 0);
    if (somaDosCartoes !== restanteEmCentavos) {
        throw erroDeRegra(
            'A soma dos cartões (' + formatar(somaDosCartoes) + ') deve ser exatamente ' +
            formatar(restanteEmCentavos) + ', que é o valor restante após os cupons.'
        );
    }

    // --- RN0035: a excecao ao valor minimo -----------------------------------
    // "Ao realizar pagamento utilizando cupons e cartoes em conjunto, deve-se
    // sempre considerar o valor maximo dos cupons. Somente neste caso e
    // permitido que seja realizado um pagamento de um valor menor que R$ 10,00
    // no cartao."
    //
    // O "valor maximo dos cupons" e o motivo de o cupom entrar sempre pelo valor
    // cheio: nao da para usar metade de um cupom para fazer o cartao chegar aos
    // R$ 10,00. Entao quando o que sobra ja e menor que R$ 10,00, o cliente nao
    // tem escolha -- e so ai o minimo e dispensado.
    //
    // Exemplo do DRS: compra de R$ 35,00, R$ 30,00 em cupons, R$ 5,00 no cartao.
    if (usouCupons && restanteEmCentavos < MINIMO_POR_CARTAO) {
        // Um unico cartao. Dividir R$ 5,00 entre dois cartoes seria uma ESCOLHA
        // do cliente de ficar abaixo do minimo, e nao uma imposicao do valor.
        if (cartoes.length > 1) {
            throw erroDeRegra(
                'O valor restante após os cupons (' + formatar(restanteEmCentavos) +
                ') é menor que R$ 10,00 e deve ser pago em um único cartão.'
            );
        }
        return;
    }

    // --- RN0034: fora daquela excecao, cada cartao precisa de R$ 10,00 --------
    for (const pagamento of cartoes) {
        if (emCentavos(pagamento.valor) < MINIMO_POR_CARTAO) {
            throw erroDeRegra(
                'O valor mínimo por cartão é R$ 10,00 e um dos cartões recebeu ' +
                formatar(emCentavos(pagamento.valor)) + ' (RN0034).'
            );
        }
    }
}

// =============================================================================
// RF0034 - Previa do frete
//
// A tela chama este endpoint quando o cliente escolhe o endereco, para mostrar
// subtotal, frete e total antes de confirmar a compra. E so consulta: nao grava
// nada e nao finaliza nada.
// =============================================================================
rotas.get('/:clienteId/frete', async (requisicao, resposta) => {
    const clienteId = idDaUrl(requisicao.params.clienteId, 'Cliente não encontrado.');
    await exigirCliente(clienteId);

    const itens = await buscarItensDoCarrinho(clienteId);
    const subtotalEmCentavos = itens.reduce(
        (soma, item) => soma + emCentavos(item.precoUnitario) * item.quantidade, 0);
    const quantidadeDeItens = itens.reduce((soma, item) => soma + item.quantidade, 0);

    const valorDoFrete = frete.calcular(requisicao.query.estado, quantidadeDeItens);
    const freteEmCentavos = emCentavos(valorDoFrete);

    resposta.json({
        subtotal: emReais(subtotalEmCentavos),
        frete: emReais(freteEmCentavos),
        total: emReais(subtotalEmCentavos + freteEmCentavos),
        quantidadeDeItens
    });
});

// =============================================================================
// Cupons disponiveis do cliente
//
// Traz os promocionais da loja (cliente_id NULL) e os cupons de troca dele,
// sempre sem os ja usados. A tela de pagamento monta a lista a partir daqui.
// =============================================================================
rotas.get('/:clienteId/cupons', async (requisicao, resposta) => {
    const clienteId = idDaUrl(requisicao.params.clienteId, 'Cliente não encontrado.');
    await exigirCliente(clienteId);

    const cupons = await consultar(
        `SELECT id, codigo, tipo, valor
           FROM tb_cupom
          WHERE usado = FALSE
            AND (cliente_id IS NULL OR cliente_id = $1)
          ORDER BY tipo, valor`,
        [clienteId]
    );

    resposta.json(cupons);
});

// =============================================================================
// RF0033 / RF0038 - Finalizar a compra
// =============================================================================
rotas.post('/:clienteId', async (requisicao, resposta) => {
    const clienteId = idDaUrl(requisicao.params.clienteId, 'Cliente não encontrado.');
    const dados = requisicao.body;

    validacao.validarFinalizacaoDeCompra(dados);
    await exigirCliente(clienteId);

    // --- 1. O carrinho -------------------------------------------------------
    // RF0033 - a compra nasce de um carrinho. Sem itens nao ha o que comprar.
    //
    // Nao revalidamos o estoque aqui: isso seria a RN0032 (estoque alterado
    // entre a adicao e a compra), explicitamente fora do escopo desta fase. Como
    // esta fase tambem nao da baixa em estoque (RF0053), o estoque nao muda
    // entre um momento e outro.
    const itens = await buscarItensDoCarrinho(clienteId);
    if (itens.length === 0) throw erroDeRegra('O carrinho está vazio.');

    const subtotalEmCentavos = itens.reduce(
        (soma, item) => soma + emCentavos(item.precoUnitario) * item.quantidade, 0);
    const quantidadeDeItens = itens.reduce((soma, item) => soma + item.quantidade, 0);

    // --- 2. O endereco de entrega (RF0035) -----------------------------------
    // Precisamos do ESTADO antes de gravar qualquer coisa, porque e ele que
    // define o frete. O endereco novo so e inserido la na transacao.
    let estadoDeEntrega;
    if (dados.enderecoId) {
        const enderecos = await consultar(
            'SELECT estado FROM tb_endereco WHERE id = $1 AND cliente_id = $2',
            [dados.enderecoId, clienteId]
        );
        if (enderecos.length === 0) throw erroDeRegra('Endereço de entrega não encontrado para este cliente.');
        estadoDeEntrega = enderecos[0].estado;
    } else {
        estadoDeEntrega = dados.novoEndereco.estado;
    }

    // --- 3. Os valores (RF0034) ----------------------------------------------
    const freteEmCentavos = emCentavos(frete.calcular(estadoDeEntrega, quantidadeDeItens));
    const totalEmCentavos = subtotalEmCentavos + freteEmCentavos;

    // --- 4. O pagamento (RF0036, RF0037, RN0033 a RN0036) --------------------
    const cupons = await carregarCupons(clienteId, dados.cupons || []);
    const valorEmCupons = validarRegrasDeCupons(cupons, totalEmCentavos);

    const cartoes = dados.cartoes || [];
    const restanteEmCentavos = totalEmCentavos - valorEmCupons;
    validarRegrasDeCartoes(cartoes, restanteEmCentavos, cupons.length > 0);

    // RN0036 - o que os cupons passaram do total vira cupom de troca.
    const trocoEmCentavos = Math.max(0, -restanteEmCentavos);

    // Os cartoes existentes precisam ser do cliente; os novos precisam de uma
    // bandeira valida (RN0025). Resolvido antes da transacao para falhar cedo.
    for (const pagamento of cartoes) {
        if (pagamento.cartaoId) {
            const encontrados = await consultar(
                'SELECT id FROM tb_cartao_credito WHERE id = $1 AND cliente_id = $2',
                [pagamento.cartaoId, clienteId]
            );
            if (encontrados.length === 0) throw erroDeRegra('Cartão de crédito não encontrado para este cliente.');
        } else {
            pagamento.bandeira = await exigirBandeira(pagamento.novoCartao.bandeira);
        }
    }

    // --- 5. Gravacao, tudo dentro de uma transacao ---------------------------
    // Sao sete tabelas envolvidas. Se qualquer passo falhar, nada pode ficar
    // gravado: um pedido sem itens, um cupom marcado como usado sem a compra
    // correspondente ou um carrinho esvaziado sem pedido seriam estados que o
    // cliente nao conseguiria desfazer sozinho.
    const conexao = await pool.connect();
    let pedidoId;
    let cupomDeTrocaGerado = null;
    try {
        await conexao.query('BEGIN');

        // 5.1 - endereco (RF0035)
        let enderecoId = dados.enderecoId;
        if (!enderecoId) {
            const endereco = dados.novoEndereco;
            const inserido = await conexao.query(
                `INSERT INTO tb_endereco
                     (cliente_id, nome, tipo_residencia, tipo_logradouro, logradouro,
                      numero, complemento, bairro, cep, cidade, estado, pais,
                      observacoes, tipo_endereco, salvo_no_perfil)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ENTREGA', $14)
                 RETURNING id`,
                [clienteId, endereco.nome, endereco.tipoResidencia, endereco.tipoLogradouro,
                 endereco.logradouro, endereco.numero, endereco.complemento || null,
                 endereco.bairro, endereco.cep, endereco.cidade, endereco.estado,
                 endereco.pais, endereco.observacoes || null,
                 // RF0035 - o cliente escolhe se o endereco novo entra no perfil.
                 dados.salvarEnderecoNoPerfil === true]
            );
            enderecoId = inserido.rows[0].id;
        }

        // 5.2 - o pedido (RF0038)
        const pedido = await conexao.query(
            `INSERT INTO tb_pedido
                 (cliente_id, endereco_id, status, subtotal, frete, total, data_pedido)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING id`,
            [clienteId, enderecoId, STATUS_INICIAL, emReais(subtotalEmCentavos),
             emReais(freteEmCentavos), emReais(totalEmCentavos)]
        );
        pedidoId = pedido.rows[0].id;

        // 5.3 - os itens, com nome e preco congelados no momento da compra
        for (const item of itens) {
            await conexao.query(
                `INSERT INTO tb_pedido_item
                     (pedido_id, produto_id, nome_produto, preco_unitario, quantidade)
                 VALUES ($1, $2, $3, $4, $5)`,
                [pedidoId, item.produtoId, item.nome, item.precoUnitario, item.quantidade]
            );
        }

        // 5.4 - os cartoes (RF0036)
        for (const pagamento of cartoes) {
            let cartaoId = pagamento.cartaoId;
            if (!cartaoId) {
                const novo = pagamento.novoCartao;
                const inserido = await conexao.query(
                    `INSERT INTO tb_cartao_credito
                         (cliente_id, bandeira_id, numero, nome_impresso, validade,
                          codigo_seguranca, preferencial, salvo_no_perfil)
                     VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
                     RETURNING id`,
                    [clienteId, pagamento.bandeira.id, novo.numero, novo.nomeImpresso,
                     novo.validade, novo.codigoSeguranca,
                     // RF0036 - o cliente escolhe se o cartao novo entra no perfil.
                     pagamento.salvarNoPerfil === true]
                );
                cartaoId = inserido.rows[0].id;
            }

            await conexao.query(
                `INSERT INTO tb_pedido_pagamento (pedido_id, tipo, cartao_id, valor)
                 VALUES ($1, 'CARTAO', $2, $3)`,
                [pedidoId, cartaoId, pagamento.valor]
            );
        }

        // 5.5 - os cupons (RF0037)
        for (const cupom of cupons) {
            await conexao.query(
                `INSERT INTO tb_pedido_pagamento (pedido_id, tipo, cupom_id, valor)
                 VALUES ($1, 'CUPOM', $2, $3)`,
                [pedidoId, cupom.id, cupom.valor]
            );
            // Uso unico: o cupom nunca e apagado, so deixa de estar disponivel.
            await conexao.query('UPDATE tb_cupom SET usado = TRUE WHERE id = $1', [cupom.id]);
        }

        // 5.6 - RN0036: o troco vira um cupom de troca do cliente
        if (trocoEmCentavos > 0) {
            // O codigo usa o id do pedido, que e unico -- entao o codigo tambem e.
            const codigo = 'TROCA-' + String(pedidoId).padStart(5, '0');
            const gerado = await conexao.query(
                `INSERT INTO tb_cupom (codigo, tipo, valor, cliente_id, pedido_origem_id)
                 VALUES ($1, 'TROCA', $2, $3, $4)
                 RETURNING id, codigo, valor`,
                [codigo, emReais(trocoEmCentavos), clienteId, pedidoId]
            );
            cupomDeTrocaGerado = gerado.rows[0];
        }

        // 5.7 - o carrinho vira pedido e deixa de existir
        await conexao.query('DELETE FROM tb_carrinho_item WHERE cliente_id = $1', [clienteId]);

        await conexao.query('COMMIT');
    } catch (erro) {
        await conexao.query('ROLLBACK');
        throw erro;
    } finally {
        conexao.release();
    }

    // RNF0012 - a trilha registra a compra depois de ela existir de fato.
    await auditoria.registrar(
        'Pedido', pedidoId, 'CRIACAO', 'cliente-' + clienteId,
        'Compra finalizada com status ' + STATUS_INICIAL + ' (RF0038)'
    );
    if (cupomDeTrocaGerado) {
        await auditoria.registrar(
            'Cupom', cupomDeTrocaGerado.id, 'CRIACAO', 'cliente-' + clienteId,
            'Cupom de troca ' + cupomDeTrocaGerado.codigo + ' gerado pelo troco dos cupons (RN0036)'
        );
    }

    const [pedidoCompleto] = await buscarPedidos(clienteId, pedidoId);
    resposta.status(201).json(pedidoCompleto);
});

// =============================================================================
// Pedidos do cliente
// =============================================================================
rotas.get('/:clienteId', async (requisicao, resposta) => {
    const clienteId = idDaUrl(requisicao.params.clienteId, 'Cliente não encontrado.');
    await exigirCliente(clienteId);

    resposta.json(await buscarPedidos(clienteId));
});

/**
 * Monta os pedidos de um cliente, com itens, pagamentos e endereco.
 *
 * Mesma ideia do montarClientes(): tres consultas no total em vez de uma por
 * pedido, com o agrupamento feito aqui em memoria.
 *
 * @param pedidoId quando informado, traz so aquele pedido
 */
async function buscarPedidos(clienteId, pedidoId = null) {
    const pedidos = await consultar(
        `SELECT p.id, p.status, p.subtotal, p.frete, p.total,
                TO_CHAR(p.data_pedido, 'DD/MM/YYYY HH24:MI') AS data_pedido,
                e.nome AS endereco_nome, e.tipo_logradouro, e.logradouro, e.numero,
                e.complemento, e.bairro, e.cidade, e.estado, e.cep
           FROM tb_pedido p
           JOIN tb_endereco e ON e.id = p.endereco_id
          WHERE p.cliente_id = $1
            AND ($2::bigint IS NULL OR p.id = $2)
          ORDER BY p.id DESC`,
        [clienteId, pedidoId]
    );
    if (pedidos.length === 0) return [];

    const ids = pedidos.map((pedido) => pedido.id);

    const itens = await consultar(
        `SELECT pedido_id, nome_produto, preco_unitario, quantidade
           FROM tb_pedido_item
          WHERE pedido_id = ANY($1)
          ORDER BY id`,
        [ids]
    );

    // Um LEFT JOIN em cada lado porque a linha de pagamento tem OU cartao OU
    // cupom, nunca os dois -- o JOIN comum descartaria metade das linhas.
    const pagamentos = await consultar(
        `SELECT pg.pedido_id, pg.tipo, pg.valor,
                c.numero AS numero_cartao, b.nome AS bandeira, cp.codigo AS codigo_cupom
           FROM tb_pedido_pagamento pg
           LEFT JOIN tb_cartao_credito c ON c.id = pg.cartao_id
           LEFT JOIN tb_bandeira b       ON b.id = c.bandeira_id
           LEFT JOIN tb_cupom cp         ON cp.id = pg.cupom_id
          WHERE pg.pedido_id = ANY($1)
          ORDER BY pg.id`,
        [ids]
    );

    // RN0036 - o cupom de troca que esta compra gerou, se gerou algum.
    const cuponsGerados = await consultar(
        `SELECT pedido_origem_id, codigo, valor
           FROM tb_cupom
          WHERE pedido_origem_id = ANY($1)`,
        [ids]
    );

    return pedidos.map((pedido) => ({
        id: pedido.id,
        status: pedido.status,
        dataPedido: pedido.data_pedido,
        subtotal: pedido.subtotal,
        frete: pedido.frete,
        total: pedido.total,
        enderecoEntrega: {
            nome: pedido.endereco_nome,
            resumo: [pedido.tipo_logradouro, pedido.logradouro].filter(Boolean).join(' ') +
                    ', ' + pedido.numero + (pedido.complemento ? ' - ' + pedido.complemento : '') +
                    ' - ' + pedido.bairro + ', ' + pedido.cidade + '/' + pedido.estado,
            cep: pedido.cep,
            estado: pedido.estado
        },
        itens: itens
            .filter((item) => item.pedido_id === pedido.id)
            .map((item) => ({
                nome: item.nome_produto,
                precoUnitario: item.preco_unitario,
                quantidade: item.quantidade,
                subtotal: emReais(emCentavos(item.preco_unitario) * item.quantidade)
            })),
        pagamentos: pagamentos
            .filter((pagamento) => pagamento.pedido_id === pedido.id)
            .map((pagamento) => ({
                tipo: pagamento.tipo,
                // Mesmo cuidado da fase anterior: o numero do cartao nunca sai
                // inteiro, so os 4 ultimos digitos.
                descricao: pagamento.tipo === 'CARTAO'
                    ? pagamento.bandeira + ' final ' + finalDoCartao(pagamento.numero_cartao)
                    : 'Cupom ' + pagamento.codigo_cupom,
                valor: pagamento.valor
            })),
        cupomDeTrocaGerado: cuponsGerados
            .filter((cupom) => cupom.pedido_origem_id === pedido.id)
            .map((cupom) => ({ codigo: cupom.codigo, valor: cupom.valor }))[0] || null
    }));
}

module.exports = rotas;
