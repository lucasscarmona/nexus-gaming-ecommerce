// =============================================================================
// Nexus Gaming Gear - ponto de entrada da aplicacao.
//
// Este e o arquivo para ler primeiro. Ele faz quatro coisas, nesta ordem:
//   1. configura como as requisicoes sao lidas (JSON, CORS);
//   2. serve as telas (a pasta public);
//   3. registra as rotas da API;
//   4. trata os erros, num unico lugar.
//
// No backend antigo nada disso aparecia: o Spring Boot montava tudo por
// convencao e anotacoes (@SpringBootApplication, @RestController,
// @RestControllerAdvice), e o arquivo principal tinha uma linha so. Era menos
// codigo para escrever, mas tambem nenhum lugar onde ver como a aplicacao se
// monta. Aqui a montagem esta escrita.
// =============================================================================

const express = require('express');
const path = require('path');

const { prepararBanco } = require('./db');
const rotasClientes = require('./rotas-clientes');
const rotasBandeiras = require('./rotas-bandeiras');
const rotasProdutos = require('./rotas-produtos');
const rotasPedidos = require('./rotas-pedidos');
// O rotas-carrinho exporta duas coisas (o router e a leitura do carrinho, que o
// rotas-pedidos reaproveita), por isso aqui pegamos so a parte .rotas.
const rotasCarrinho = require('./rotas-carrinho').rotas;

// 8080 e a porta que o front-end e os testes do Cypress esperam.
const PORTA = 8080;

const app = express();

// -----------------------------------------------------------------------------
// 1. Como as requisicoes sao lidas
// -----------------------------------------------------------------------------

// Le o corpo JSON das requisicoes (o que o fetch envia) e o deixa pronto em
// requisicao.body. Sem esta linha, requisicao.body seria undefined em todo POST.
app.use(express.json());

// CORS liberado, como o backend antigo fazia com @CrossOrigin(origins = "*").
//
// Por que e necessario: o navegador bloqueia, por seguranca, chamadas de
// JavaScript para um endereco diferente do da pagina. O JS das telas chama a
// API por URL absoluta (http://localhost:8080/api/...), e o Cypress abre a
// aplicacao dentro de um iframe dele -- nos dois casos o navegador quer ouvir
// do servidor que a chamada e permitida. Estes cabecalhos sao essa permissao.
app.use((requisicao, resposta, proximo) => {
    resposta.setHeader('Access-Control-Allow-Origin', '*');
    resposta.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    resposta.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Antes de um PUT ou PATCH com JSON, o navegador manda um OPTIONS para
    // perguntar se pode. Respondemos "pode" (204) e encerramos aqui, sem
    // deixar a pergunta chegar as rotas.
    if (requisicao.method === 'OPTIONS') return resposta.status(204).send();

    // 'proximo' passa a requisicao adiante. Sem chamar isso, ela ficaria presa
    // aqui e o navegador esperaria para sempre.
    proximo();
});

// -----------------------------------------------------------------------------
// 2. As telas
// -----------------------------------------------------------------------------

// Serve a pasta public como arquivos estaticos: http://localhost:8080/ devolve
// public/index.html. E por isso que o front-end e a API vivem no mesmo
// endereco, e o projeto sobe com um comando so.
app.use(express.static(path.join(__dirname, '..', 'public')));

// -----------------------------------------------------------------------------
// 3. As rotas da API
//
// Cada prefixo abaixo aponta para um arquivo:
//   /api/clientes  -> rotas-clientes.js   (cadastro, alteracao, inativacao...)
//   /api/bandeiras -> rotas-bandeiras.js  (bandeiras de cartao, so leitura)
//   /api/produtos  -> rotas-produtos.js   (catalogo da loja, so leitura)
//   /api/carrinho  -> rotas-carrinho.js   (RF0031/RF0032)
//   /api/pedidos   -> rotas-pedidos.js    (RF0033 a RF0038: frete, pagamento,
//                                          finalizacao e consulta de pedidos)
// -----------------------------------------------------------------------------
app.use('/api/clientes', rotasClientes);
app.use('/api/bandeiras', rotasBandeiras);
app.use('/api/produtos', rotasProdutos);
app.use('/api/carrinho', rotasCarrinho);
app.use('/api/pedidos', rotasPedidos);

// -----------------------------------------------------------------------------
// 4. Tratamento de erros, num unico lugar
//
// Qualquer erro lancado dentro de uma rota cai aqui. O Express 5 encaminha
// automaticamente os erros de funcoes async, por isso as rotas podem lancar
// erro sem nenhum try/catch. Era o papel do GlobalExceptionHandler.
//
// A distincao entre os dois casos importa: se o usuario errou, ele precisa ler
// a mensagem na tela; se a aplicacao quebrou, a mensagem pode conter detalhes
// internos do banco, e ai ela vai so para o console do servidor.
//
// Os quatro parametros nao sao opcionais: e assim que o Express reconhece uma
// funcao como tratadora de erro, e nao como uma rota comum. 'proximo' nao e
// usado, mas precisa estar na assinatura.
// -----------------------------------------------------------------------------
app.use((erro, requisicao, resposta, proximo) => {
    // Erro previsto: CPF duplicado, senha fraca, cliente inexistente.
    if (erro.regraDeNegocio) {
        return resposta.status(400).json({ message: erro.message });
    }

    // 23505 e o codigo do Postgres para violacao de UNIQUE. Chega aqui no caso
    // raro de dois cadastros com o mesmo CPF passarem pela checagem antes de
    // qualquer um dos dois gravar. O banco e a ultima linha de defesa -- e e
    // por isso que a coluna tem UNIQUE, e nao so a checagem no codigo.
    if (erro.code === '23505') {
        return resposta.status(400).json({ message: 'CPF ou e-mail já cadastrado.' });
    }

    // Qualquer outra coisa e bug nosso ou banco fora do ar: registra por
    // completo no console e devolve uma mensagem generica.
    console.error('Erro inesperado:', erro);
    resposta.status(500).json({ message: 'Erro interno no servidor.' });
});

// -----------------------------------------------------------------------------
// Subida do servidor
//
// Primeiro prepararBanco (cria as tabelas e popula as bandeiras), e so depois
// o listen. A ordem evita que a primeira requisicao chegue antes das tabelas
// existirem.
// -----------------------------------------------------------------------------
prepararBanco()
    .then(() => {
        app.listen(PORTA, () => {
            console.log('Nexus Gaming Gear no ar em http://localhost:' + PORTA);
        });
    })
    .catch((erro) => {
        // Se o banco nao responde, nao faz sentido abrir a porta: toda
        // requisicao falharia. Melhor parar aqui com uma mensagem clara.
        console.error('Nao foi possivel conectar ao PostgreSQL:', erro.message);
        console.error('Verifique se o PostgreSQL esta rodando em localhost:5432');
        console.error('e se o banco nexus_gaming_db existe.');
        process.exit(1);
    });
