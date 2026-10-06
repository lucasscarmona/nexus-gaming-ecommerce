// =============================================================================
// Todos os endpoints de /api/clientes.
//
// No backend antigo este arquivo eram quatro camadas: ClienteController (rotas)
// -> ClienteService (regras) -> ClienteRepository (banco) -> Cliente (entidade),
// mais 9 DTOs. Para entender um unico cadastro era preciso abrir 7 arquivos e
// seguir o caminho entre eles.
//
// Aqui cada endpoint e uma funcao: recebe a requisicao, valida, conversa com o
// banco, responde. O caminho inteiro de uma operacao cabe na tela.
//
// A ordem dos endpoints neste arquivo:
//   POST   /                        cadastrar cliente              (RF0021)
//   GET    /                        listar / filtrar               (RF0024)
//   GET    /:id                     buscar um cliente
//   PUT    /:id                     alterar dados cadastrais       (RF0022)
//   PATCH  /:id/inativar            soft delete                    (RF0023)
//   PATCH  /:id/senha               alterar so a senha             (RF0028)
//   POST   /:id/enderecos           adicionar endereco             (RF0026)
//   GET    /:id/enderecos           listar enderecos
//   PUT    /:id/enderecos/:id       alterar um endereco            (RNF0034)
//   POST   /:id/cartoes             adicionar cartao               (RF0027)
//   GET    /:id/cartoes             listar cartoes
// =============================================================================

const express = require('express');
const bcrypt = require('bcryptjs');

const { consultar, pool } = require('./db');
const validacao = require('./validacao');
const auditoria = require('./auditoria');

const { erroDeRegra } = validacao;
const rotas = express.Router();

// Custo do BCrypt: 2^10 rodadas de calculo para gerar um hash. Quanto maior,
// mais lento para o atacante testar senhas por tentativa e erro -- e tambem
// mais lento para nos. 10 e o equilibrio que o Spring Security usava por
// padrao no backend antigo, entao as senhas ja gravadas continuam compativeis.
const CUSTO_BCRYPT = 10;

// -----------------------------------------------------------------------------
// Consultas e conversoes reaproveitadas pelas rotas
// -----------------------------------------------------------------------------

// A data de nascimento sai do banco convertida para texto AAAA-MM-DD pelo
// TO_CHAR, e nao como data. Motivo pratico: a tela joga esse valor direto num
// <input type="date">, que SO aceita esse formato. Se deixassemos o driver
// devolver uma data, ela viraria "1998-03-15T00:00:00.000Z" no JSON e o campo
// apareceria vazio na tela. Convertendo no SQL, o fuso horario nunca entra na
// conta.
const SQL_CLIENTE = `
    SELECT id, nome, genero, cpf,
           TO_CHAR(data_nascimento, 'YYYY-MM-DD') AS data_nascimento,
           tipo, ddd, numero, email, ativo
      FROM tb_cliente`;

/**
 * Converte uma linha de tb_endereco no formato que a API publica.
 *
 * A traducao e necessaria e e feita a mao de proposito: o banco usa
 * nome_com_underscore (convencao SQL) e a API usa nomeEmCamelCase (convencao
 * JavaScript/JSON). Escrito campo por campo, da para ver exatamente o que a
 * API expoe -- e o que ela nao expoe.
 */
function respostaDeEndereco(linha) {
    return {
        id: linha.id,
        nome: linha.nome,
        // RN0023 - tipo de residencia e tipo de logradouro fazem parte da
        // composicao obrigatoria do endereco.
        tipoResidencia: linha.tipo_residencia,
        tipoLogradouro: linha.tipo_logradouro,
        logradouro: linha.logradouro,
        numero: linha.numero,
        complemento: linha.complemento,
        bairro: linha.bairro,
        cep: linha.cep,
        cidade: linha.cidade,
        estado: linha.estado,
        pais: linha.pais,
        observacoes: linha.observacoes,
        tipoEndereco: linha.tipo_endereco
    };
}

/** Converte uma linha de tb_cartao_credito no formato que a API publica. */
function respostaDeCartao(linha) {
    // O numero completo do cartao e o CVV NUNCA saem do servidor. A tela so
    // precisa dos 4 ultimos digitos, o suficiente para o cliente reconhecer
    // qual dos cartoes dele e aquele.
    const numero = linha.numero || '';
    const mascarado = numero.length >= 4
        ? '**** **** **** ' + numero.slice(-4)
        : '****';

    return {
        id: linha.id,
        numeroMascarado: mascarado,
        nomeImpresso: linha.nome_impresso,
        validade: linha.validade,
        bandeira: linha.bandeira,
        preferencial: linha.preferencial
    };
}

/**
 * Monta a resposta completa de uma lista de clientes, cada um com seus
 * enderecos e cartoes.
 *
 * Por que nao uma consulta de enderecos por cliente: numa lista de 40 clientes
 * isso daria 81 idas ao banco (1 + 40 + 40). Aqui sao 3, sempre -- a dos
 * clientes (feita por quem chamou), uma com TODOS os enderecos dessa lista e
 * uma com TODOS os cartoes -- e o agrupamento acontece aqui, em memoria.
 *
 * Esse era justamente o problema que o Hibernate criava sem avisar no backend
 * antigo: as listas de endereco/cartao eram carregadas sob demanda, uma
 * consulta por cliente, e isso nao aparecia em lugar nenhum do codigo Java.
 */
async function montarClientes(linhasDeClientes) {
    if (linhasDeClientes.length === 0) return [];

    const ids = linhasDeClientes.map((cliente) => cliente.id);

    // "= ANY($1)" e o jeito do Postgres de dizer "onde cliente_id esta nesta
    // lista de ids", passando a lista como um unico parametro.
    const enderecos = await consultar(
        `SELECT id, cliente_id, nome, tipo_residencia, tipo_logradouro, logradouro,
                numero, complemento, bairro, cep, cidade, estado, pais,
                observacoes, tipo_endereco
           FROM tb_endereco
          WHERE cliente_id = ANY($1) AND salvo_no_perfil = TRUE
          ORDER BY id`,
        [ids]
    );

    // O JOIN traz o NOME da bandeira. Sem ele a API devolveria bandeira_id = 3,
    // que nao diz nada para quem esta olhando a tela.
    // codigo_seguranca nao esta na lista de colunas: o CVV nao sai do banco.
    const cartoes = await consultar(
        `SELECT c.id, c.cliente_id, c.numero, c.nome_impresso, c.validade,
                c.preferencial, b.nome AS bandeira
           FROM tb_cartao_credito c
           JOIN tb_bandeira b ON b.id = c.bandeira_id
          WHERE c.cliente_id = ANY($1) AND c.salvo_no_perfil = TRUE
          ORDER BY c.id`,
        [ids]
    );

    return linhasDeClientes.map((cliente) => ({
        id: cliente.id,
        nome: cliente.nome,
        genero: cliente.genero,
        cpf: cliente.cpf,
        dataNascimento: cliente.data_nascimento,
        // As tres colunas do telefone voltam a aparecer como um conjunto na API,
        // porque e assim que a tela trata o telefone.
        telefoneTipo: cliente.tipo,
        telefoneDdd: cliente.ddd,
        telefoneNumero: cliente.numero,
        email: cliente.email,
        ativo: cliente.ativo,
        // A senha nao esta aqui, e e intencional: o hash nunca sai do servidor.
        enderecos: enderecos
            .filter((endereco) => endereco.cliente_id === cliente.id)
            .map(respostaDeEndereco),
        cartoes: cartoes
            .filter((cartao) => cartao.cliente_id === cliente.id)
            .map(respostaDeCartao)
    }));
}

/** Busca um cliente ja no formato da API, ou null se nao existir. */
async function buscarCliente(id) {
    const linhas = await consultar(SQL_CLIENTE + ' WHERE id = $1', [id]);
    const [cliente] = await montarClientes(linhas);
    return cliente || null;
}

/** Interrompe a requisicao se o cliente nao existir. */
async function exigirCliente(id) {
    const linhas = await consultar('SELECT id FROM tb_cliente WHERE id = $1', [id]);
    if (linhas.length === 0) throw erroDeRegra('Cliente não encontrado.');
}

/**
 * O id chega da URL sempre como texto. Se nao for um numero inteiro positivo,
 * nao existe registro com esse id -- respondemos a mesma mensagem de "nao
 * encontrado" em vez de deixar o Postgres reclamar de tipo invalido, o que
 * daria um erro 500 confuso para quem digitou /api/clientes/abc.
 */
function idDaUrl(valor, mensagemSeInvalido) {
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero <= 0) throw erroDeRegra(mensagemSeInvalido);
    return numero;
}

/**
 * RN0025 - a bandeira informada precisa existir na tabela de dominio.
 * LOWER nos dois lados faz a comparacao ignorar maiusculas e minusculas, para
 * que "visa" e "Visa" encontrem a mesma bandeira.
 */
async function exigirBandeira(nome) {
    const linhas = await consultar(
        'SELECT id, nome FROM tb_bandeira WHERE LOWER(nome) = LOWER($1)',
        [nome || '']
    );
    if (linhas.length === 0) throw erroDeRegra('Bandeira de cartão não registrada no sistema.');
    return linhas[0];
}

// =============================================================================
// RF0021 - Cadastrar cliente
// =============================================================================
rotas.post('/', async (requisicao, resposta) => {
    const dados = requisicao.body;

    validacao.validarCadastroDeCliente(dados);

    // A ordem das tres checagens abaixo e a mesma do backend antigo, e importa:
    // quem tenta se cadastrar com um CPF que ja existe deve ler "CPF já
    // cadastrado", nao uma reclamacao sobre o e-mail.
    const comMesmoCpf = await consultar('SELECT id FROM tb_cliente WHERE cpf = $1', [dados.cpf]);
    if (comMesmoCpf.length > 0) throw erroDeRegra('CPF já cadastrado.');

    const comMesmoEmail = await consultar('SELECT id FROM tb_cliente WHERE email = $1', [dados.email]);
    if (comMesmoEmail.length > 0) throw erroDeRegra('E-mail já cadastrado.');

    // RNF0032 - a confirmacao de senha existe para pegar erro de digitacao:
    // sem ela, o cliente poderia criar a conta com uma senha que nao sabe qual e.
    if (dados.senha !== dados.confirmacaoSenha) {
        throw erroDeRegra('A senha e a confirmação de senha não conferem.');
    }

    // Validada antes de abrir a transacao: se a bandeira nao existe, melhor
    // descobrir agora do que no meio da gravacao.
    const bandeira = dados.cartao ? await exigirBandeira(dados.cartao.bandeira) : null;

    // RNF0033 - o BCrypt transforma a senha num hash irreversivel. Nem nos
    // conseguimos descobrir a senha original a partir do que vai para o banco;
    // na hora do login o que se compara sao os hashes.
    const senhaCriptografada = await bcrypt.hash(dados.senha, CUSTO_BCRYPT);

    // RN0021 + RN0022 - o cadastro exige endereco de cobranca e de entrega. Um
    // unico endereco do tipo AMBOS atende os dois quando o cliente usa o mesmo.
    const tipoEndereco = dados.endereco.tipoEndereco || 'AMBOS';

    // -------------------------------------------------------------------------
    // Transacao: cliente, endereco e cartao entram juntos, ou nenhum entra.
    //
    // Sem isso, uma falha ao gravar o endereco deixaria no banco um cliente sem
    // endereco nenhum -- um cadastro pela metade, que o RN0026 nao admite, e
    // que ninguem conseguiria corrigir pela tela.
    //
    // Pegamos uma conexao especifica do pool (e nao o pool inteiro) porque
    // BEGIN e COMMIT valem para UMA conexao: se os comandos fossem distribuidos
    // entre conexoes diferentes, cada um estaria em sua propria transacao.
    // -------------------------------------------------------------------------
    const conexao = await pool.connect();
    let clienteId;
    try {
        await conexao.query('BEGIN');

        // RETURNING id: o Postgres devolve o id gerado na mesma ida ao banco,
        // sem precisar de um SELECT depois para descobrir qual foi.
        const clienteInserido = await conexao.query(
            `INSERT INTO tb_cliente
                 (nome, genero, cpf, data_nascimento, email, senha, tipo, ddd, numero, ativo)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
             RETURNING id`,
            [dados.nome, dados.genero, dados.cpf, dados.dataNascimento, dados.email,
             senhaCriptografada, dados.telefoneTipo, dados.telefoneDdd, dados.telefoneNumero]
        );
        clienteId = clienteInserido.rows[0].id;

        await conexao.query(
            `INSERT INTO tb_endereco
                 (cliente_id, nome, tipo_residencia, tipo_logradouro, logradouro,
                  numero, complemento, bairro, cep, cidade, estado, pais,
                  observacoes, tipo_endereco)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [clienteId, dados.endereco.nome, dados.endereco.tipoResidencia,
             dados.endereco.tipoLogradouro, dados.endereco.logradouro, dados.endereco.numero,
             dados.endereco.complemento || null, dados.endereco.bairro, dados.endereco.cep,
             dados.endereco.cidade, dados.endereco.estado, dados.endereco.pais,
             dados.endereco.observacoes || null, tipoEndereco]
        );

        if (dados.cartao) {
            // preferencial = TRUE sem condicao: e o primeiro cartao do cliente,
            // logo nao ha outro para disputar o lugar.
            await conexao.query(
                `INSERT INTO tb_cartao_credito
                     (cliente_id, bandeira_id, numero, nome_impresso, validade,
                      codigo_seguranca, preferencial)
                 VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
                [clienteId, bandeira.id, dados.cartao.numero, dados.cartao.nomeImpresso,
                 dados.cartao.validade, dados.cartao.codigoSeguranca]
            );
        }

        await conexao.query('COMMIT');
    } catch (erro) {
        // Desfaz tudo que foi feito desde o BEGIN e repassa o erro para o
        // tratamento central do server.js.
        await conexao.query('ROLLBACK');
        throw erro;
    } finally {
        // Devolve a conexao ao pool. Sem este release, cada cadastro consumiria
        // uma conexao para sempre e a aplicacao travaria depois de algumas.
        conexao.release();
    }

    await auditoria.registrar(
        'Cliente', clienteId, 'CRIACAO', 'cliente-' + clienteId,
        'Cadastro de cliente realizado (RF0021)'
    );

    // 201 Created, e nao 200: a resposta informa que um recurso novo passou a
    // existir. A tela depende disso para saber que deu certo.
    resposta.status(201).json(await buscarCliente(clienteId));
});

// =============================================================================
// RF0024 - Listar clientes (sem filtro) ou consultar por filtro
// =============================================================================
rotas.get('/', async (requisicao, resposta) => {
    const { nome, cpf, email, telefone } = requisicao.query;

    // Parametros de URL chegam sempre como texto, inclusive "false". Sem esta
    // conversao, a condicao ativo = 'false' no SQL receberia um texto onde o
    // Postgres espera um booleano.
    let ativo = null;
    if (requisicao.query.ativo === 'true') ativo = true;
    if (requisicao.query.ativo === 'false') ativo = false;

    const semNenhumFiltro = nome === undefined && cpf === undefined && email === undefined
        && telefone === undefined && requisicao.query.ativo === undefined;

    let linhas;
    if (semNenhumFiltro) {
        // A listagem padrao mostra so os ativos: um cliente inativado (RF0023)
        // nao deve aparecer como se fosse cliente da loja.
        linhas = await consultar(SQL_CLIENTE + ' WHERE ativo = TRUE ORDER BY id');
    } else {
        // Um unico SQL atende qualquer combinacao de filtros. O truque esta em
        // cada linha do WHERE: quando o parametro nao veio (NULL) ou veio vazio,
        // a condicao e sempre verdadeira e simplesmente nao restringe nada.
        // Assim nao precisamos montar o SQL por concatenacao -- que e como
        // nascem as brechas de SQL injection.
        //
        // O ::text e o ::boolean dizem ao Postgres de que tipo e cada
        // parametro; sem eles, ele nao consegue adivinhar o tipo de um NULL.
        // LIKE com % dos dois lados = "contem"; cpf usa = porque busca de CPF
        // por pedaco nao faz sentido.
        linhas = await consultar(
            SQL_CLIENTE + `
             WHERE ($1::text    IS NULL OR $1 = '' OR LOWER(nome)  LIKE '%' || LOWER($1) || '%')
               AND ($2::text    IS NULL OR $2 = '' OR cpf = $2)
               AND ($3::text    IS NULL OR $3 = '' OR LOWER(email) LIKE '%' || LOWER($3) || '%')
               AND ($4::text    IS NULL OR $4 = '' OR numero       LIKE '%' || $4 || '%')
               AND ($5::boolean IS NULL OR ativo = $5)
             ORDER BY id`,
            [nome ?? null, cpf ?? null, email ?? null, telefone ?? null, ativo]
        );
    }

    resposta.json(await montarClientes(linhas));
});

// =============================================================================
// Buscar um cliente pelo id -- usado pela tela de alteracao para preencher o
// formulario com os dados atuais.
// =============================================================================
rotas.get('/:id', async (requisicao, resposta) => {
    const id = idDaUrl(requisicao.params.id, 'Cliente não encontrado.');

    const cliente = await buscarCliente(id);
    if (!cliente) throw erroDeRegra('Cliente não encontrado.');

    resposta.json(cliente);
});

// =============================================================================
// RF0022 - Alterar dados cadastrais
//
// Nao mexe em CPF (e a identidade do cliente), senha (RF0028 tem fluxo proprio)
// nem enderecos/cartoes (RF0026/RF0027 tem os seus). E o RNF0034 na pratica:
// alterar uma coisa sem ter que reenviar todas as outras.
// =============================================================================
rotas.put('/:id', async (requisicao, resposta) => {
    const id = idDaUrl(requisicao.params.id, 'Cliente não encontrado.');
    const dados = requisicao.body;

    validacao.validarAlteracaoDeCliente(dados);

    // RETURNING id serve de confirmacao: se o UPDATE nao devolveu nenhuma
    // linha, e porque nao existe cliente com esse id. Resolve a existencia e a
    // alteracao em uma unica ida ao banco, sem um SELECT antes.
    const alterados = await consultar(
        `UPDATE tb_cliente
            SET nome = $1, genero = $2, data_nascimento = $3,
                tipo = $4, ddd = $5, numero = $6, email = $7
          WHERE id = $8
      RETURNING id`,
        [dados.nome, dados.genero, dados.dataNascimento, dados.telefoneTipo,
         dados.telefoneDdd, dados.telefoneNumero, dados.email, id]
    );
    if (alterados.length === 0) throw erroDeRegra('Cliente não encontrado.');

    await auditoria.registrar(
        'Cliente', id, 'ALTERACAO', 'cliente-' + id,
        'Dados cadastrais alterados (RF0022)'
    );

    resposta.json(await buscarCliente(id));
});

// =============================================================================
// RF0023 - Inativar cliente (soft delete)
//
// O registro NAO e apagado: so recebe ativo = FALSE. E a diferenca que o
// requisito cobra entre inativacao logica e exclusao fisica -- apagar o cliente
// levaria embora o historico de pedidos, as notas fiscais e a trilha de
// auditoria dele. Por isso esta aplicacao nao tem nenhum DELETE, em lugar nenhum.
// =============================================================================
rotas.patch('/:id/inativar', async (requisicao, resposta) => {
    const id = idDaUrl(requisicao.params.id, 'Cliente não encontrado.');

    const inativados = await consultar(
        'UPDATE tb_cliente SET ativo = FALSE WHERE id = $1 RETURNING id',
        [id]
    );
    if (inativados.length === 0) throw erroDeRegra('Cliente não encontrado.');

    await auditoria.registrar(
        'Cliente', id, 'INATIVACAO', 'cliente-' + id,
        'Cliente inativado - soft delete (RF0023)'
    );

    // 204 No Content: deu certo e nao ha nada para devolver.
    resposta.status(204).send();
});

// =============================================================================
// RF0028 / RNF0034 - Alterar apenas a senha
//
// Endpoint separado de propósito: trocar a senha nao deve exigir reenviar nome,
// data de nascimento e telefone.
// =============================================================================
rotas.patch('/:id/senha', async (requisicao, resposta) => {
    const id = idDaUrl(requisicao.params.id, 'Cliente não encontrado.');
    const dados = requisicao.body;

    validacao.validarNovaSenha(dados);

    if (dados.novaSenha !== dados.confirmacaoSenha) {
        throw erroDeRegra('A nova senha e a confirmação não conferem.');
    }

    const senhaCriptografada = await bcrypt.hash(dados.novaSenha, CUSTO_BCRYPT);

    const alterados = await consultar(
        'UPDATE tb_cliente SET senha = $1 WHERE id = $2 RETURNING id',
        [senhaCriptografada, id]
    );
    if (alterados.length === 0) throw erroDeRegra('Cliente não encontrado.');

    await auditoria.registrar(
        'Cliente', id, 'ALTERACAO_SENHA', 'cliente-' + id,
        'Senha alterada (RF0028)'
    );

    // 204, sem corpo: nada da senha -- nem o hash -- volta para a tela.
    resposta.status(204).send();
});

// =============================================================================
// RF0026 - Adicionar um endereco a um cliente ja cadastrado
// =============================================================================
rotas.post('/:id/enderecos', async (requisicao, resposta) => {
    const id = idDaUrl(requisicao.params.id, 'Cliente não encontrado.');
    const dados = requisicao.body;

    validacao.validarEndereco(dados);
    await exigirCliente(id);

    const inseridos = await consultar(
        `INSERT INTO tb_endereco
             (cliente_id, nome, tipo_residencia, tipo_logradouro, logradouro,
              numero, complemento, bairro, cep, cidade, estado, pais,
              observacoes, tipo_endereco)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, nome, tipo_residencia, tipo_logradouro, logradouro, numero,
                   complemento, bairro, cep, cidade, estado, pais, observacoes,
                   tipo_endereco`,
        [id, dados.nome, dados.tipoResidencia, dados.tipoLogradouro, dados.logradouro,
         dados.numero, dados.complemento || null, dados.bairro, dados.cep,
         dados.cidade, dados.estado, dados.pais,
         dados.observacoes || null, dados.tipoEndereco || 'AMBOS']
    );

    await auditoria.registrar(
        'Endereco', inseridos[0].id, 'CRIACAO', 'cliente-' + id,
        'Endereço adicionado (RF0026)'
    );

    resposta.status(201).json(respostaDeEndereco(inseridos[0]));
});

// =============================================================================
// Listar os enderecos de um cliente
// =============================================================================
rotas.get('/:id/enderecos', async (requisicao, resposta) => {
    const id = idDaUrl(requisicao.params.id, 'Cliente não encontrado.');
    await exigirCliente(id);

    const enderecos = await consultar(
        `SELECT id, nome, tipo_residencia, tipo_logradouro, logradouro, numero,
                complemento, bairro, cep, cidade, estado, pais, observacoes,
                tipo_endereco
           FROM tb_endereco
          WHERE cliente_id = $1 AND salvo_no_perfil = TRUE
          ORDER BY id`,
        [id]
    );

    resposta.json(enderecos.map(respostaDeEndereco));
});

// =============================================================================
// RNF0034 - Alterar um endereco isoladamente
// =============================================================================
rotas.put('/:id/enderecos/:enderecoId', async (requisicao, resposta) => {
    const NAO_ENCONTRADO = 'Endereço não encontrado para este cliente.';
    const clienteId = idDaUrl(requisicao.params.id, NAO_ENCONTRADO);
    const enderecoId = idDaUrl(requisicao.params.enderecoId, NAO_ENCONTRADO);
    const dados = requisicao.body;

    validacao.validarEndereco(dados);

    // O "AND cliente_id = $13" nao e redundante: sem ele, qualquer cliente
    // conseguiria alterar o endereco de outro trocando o numero na URL.
    //
    // COALESCE($11, tipo_endereco): se o tipo nao foi informado, mantem o que
    // ja estava gravado em vez de apagar a informacao.
    const alterados = await consultar(
        `UPDATE tb_endereco
            SET nome = $1, tipo_residencia = $2, tipo_logradouro = $3,
                logradouro = $4, numero = $5, complemento = $6, bairro = $7,
                cep = $8, cidade = $9, estado = $10, pais = $11,
                observacoes = $12, tipo_endereco = COALESCE($13::varchar, tipo_endereco)
          WHERE id = $14 AND cliente_id = $15
      RETURNING id, nome, tipo_residencia, tipo_logradouro, logradouro, numero,
                complemento, bairro, cep, cidade, estado, pais, observacoes,
                tipo_endereco`,
        [dados.nome, dados.tipoResidencia, dados.tipoLogradouro, dados.logradouro,
         dados.numero, dados.complemento || null, dados.bairro, dados.cep,
         dados.cidade, dados.estado, dados.pais,
         dados.observacoes || null, dados.tipoEndereco || null,
         enderecoId, clienteId]
    );
    if (alterados.length === 0) throw erroDeRegra(NAO_ENCONTRADO);

    await auditoria.registrar(
        'Endereco', enderecoId, 'ALTERACAO', 'cliente-' + clienteId,
        'Endereço alterado isoladamente (RNF0034)'
    );

    resposta.json(respostaDeEndereco(alterados[0]));
});

// =============================================================================
// RF0027 / RN0025 - Adicionar um cartao de credito a um cliente
// =============================================================================
rotas.post('/:id/cartoes', async (requisicao, resposta) => {
    const id = idDaUrl(requisicao.params.id, 'Cliente não encontrado.');
    const dados = requisicao.body;

    validacao.validarCartao(dados);
    await exigirCliente(id);

    // O primeiro cartao do cliente e sempre o preferencial: alguem precisa ser
    // o escolhido por padrao na hora da compra. A partir do segundo, quem
    // decide e o cliente, pela caixa de selecao da tela.
    // Só contam os cartões do perfil: um cartão usado numa compra avulsa, sem
    // ser guardado (salvo_no_perfil = FALSE), não disputa a preferência.
    const cartoesAtuais = await consultar(
        'SELECT id FROM tb_cartao_credito WHERE cliente_id = $1 AND salvo_no_perfil = TRUE',
        [id]
    );
    const sejaPreferencial = cartoesAtuais.length === 0 || dados.preferencial === true;

    // RN0025 - checado antes de gravar.
    const bandeira = await exigirBandeira(dados.bandeira);

    // So um cartao por cliente pode ser o preferencial, entao os outros perdem
    // a marca antes do novo entrar.
    if (sejaPreferencial) {
        await consultar(
            'UPDATE tb_cartao_credito SET preferencial = FALSE WHERE cliente_id = $1 AND salvo_no_perfil = TRUE',
            [id]
        );
    }

    const inseridos = await consultar(
        `INSERT INTO tb_cartao_credito
             (cliente_id, bandeira_id, numero, nome_impresso, validade,
              codigo_seguranca, preferencial)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, numero, nome_impresso, validade, preferencial`,
        [id, bandeira.id, dados.numero, dados.nomeImpresso, dados.validade,
         dados.codigoSeguranca, sejaPreferencial]
    );

    await auditoria.registrar(
        'CartaoCredito', inseridos[0].id, 'CRIACAO', 'cliente-' + id,
        'Cartão de crédito adicionado (RF0027)'
    );

    // O nome da bandeira vem do objeto que acabamos de buscar; o INSERT so
    // conhece o bandeira_id.
    resposta.status(201).json(
        respostaDeCartao({ ...inseridos[0], bandeira: bandeira.nome })
    );
});

// =============================================================================
// Listar os cartoes de um cliente (sempre mascarados)
// =============================================================================
rotas.get('/:id/cartoes', async (requisicao, resposta) => {
    const id = idDaUrl(requisicao.params.id, 'Cliente não encontrado.');
    await exigirCliente(id);

    const cartoes = await consultar(
        `SELECT c.id, c.numero, c.nome_impresso, c.validade, c.preferencial,
                b.nome AS bandeira
           FROM tb_cartao_credito c
           JOIN tb_bandeira b ON b.id = c.bandeira_id
          WHERE c.cliente_id = $1 AND c.salvo_no_perfil = TRUE
          ORDER BY c.id`,
        [id]
    );

    resposta.json(cartoes.map(respostaDeCartao));
});

module.exports = rotas;
