// =============================================================================
// Conexao com o PostgreSQL.
//
// Usamos a biblioteca 'pg' e escrevemos SQL na mao, sem ORM. A troca foi
// consciente: o Hibernate gerava as consultas sozinho a partir das anotacoes
// das classes, e nao havia como saber o que ia para o banco sem ligar o log.
// Aqui toda consulta que a aplicacao faz esta escrita por extenso no codigo.
// =============================================================================

const fs = require('fs');
const path = require('path');
const pg = require('pg');

// O PostgreSQL devolve colunas BIGINT como TEXTO, porque um bigint pode ser
// maior que o maior inteiro que o JavaScript representa com seguranca. Os ids
// desta aplicacao estao muito longe desse limite, entao pedimos ao driver para
// converte-los em numero. Sem esta linha a API devolveria {"id": "42"} com
// aspas, e nao {"id": 42} como o backend antigo devolvia.
pg.types.setTypeParser(pg.types.builtins.INT8, (valor) => Number(valor));

// Mesma historia com NUMERIC, que e o tipo das colunas de dinheiro (preco,
// frete, total). O driver devolve texto para nao perder precisao em numeros
// gigantes. Convertemos para numero para o JSON sair como 899.00 e nao "899.00".
//
// Isso NAO significa fazer conta de dinheiro com ponto flutuante: as somas e
// comparacoes de valores acontecem em centavos (numeros inteiros). Ver o
// dinheiro.js, que explica o porque.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (valor) => Number(valor));

// Um "pool" e um conjunto de conexoes que ficam abertas e sao reaproveitadas.
// Abrir uma conexao nova a cada requisicao custaria uns 20ms de handshake com
// o banco; reaproveitando, esse custo e pago uma vez so.
const pool = new pg.Pool({
    host: 'localhost',
    port: 5432,
    database: 'nexus_gaming_db',
    user: 'postgres',
    password: 'postgres'
});

/**
 * Roda uma consulta e devolve direto a lista de linhas.
 *
 * Existe so para encurtar o codigo das rotas: sem ela, cada consulta viraria
 * duas linhas (rodar e depois pegar o .rows do resultado).
 *
 * Os $1, $2... no SQL sao parametros. O valor viaja separado do texto da
 * consulta e e o driver que os junta, no banco. E isso -- e nao uma validacao
 * nossa -- que impede SQL injection: um nome de cliente como
 * "'; DROP TABLE tb_cliente; --" chega ao banco como texto a ser procurado,
 * nunca como comando a ser executado.
 */
async function consultar(sql, parametros = []) {
    const resultado = await pool.query(sql, parametros);
    return resultado.rows;
}

/**
 * Cria as tabelas (se ainda nao existirem) e popula as bandeiras.
 * Roda uma unica vez, quando o servidor sobe -- ver o final do server.js.
 *
 * E o equivalente do ddl-auto=update + data.sql do Spring, mas lendo arquivos
 * .sql que qualquer pessoa consegue abrir e entender.
 */
async function prepararBanco() {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await pool.query(schema);
    await pool.query(seed);
}

module.exports = { pool, consultar, prepararBanco };
