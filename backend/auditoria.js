    // =============================================================================
// RNF0012 - trilha de auditoria.
//
// Toda operacao que ESCREVE no banco (cadastro, alteracao, troca de senha,
// inativacao) grava uma linha em tb_auditoria. E o que permite responder
// depois "quem mudou o e-mail deste cliente, e quando?".
//
// Por que um arquivo separado e nao uma linha de INSERT dentro de cada rota:
// a auditoria e identica nos seis lugares que a usam. Centralizada, o dia que
// precisarmos gravar um campo novo (o IP da requisicao, por exemplo) muda-se
// um lugar, e nao seis.
// =============================================================================

const { consultar } = require('./db');

/**
 * Grava uma linha na trilha de auditoria.
 *
 * @param entidade            qual tabela foi afetada (ex.: 'Cliente')
 * @param entidadeId          o id do registro afetado
 * @param operacao            o que foi feito (ex.: 'CRIACAO', 'INATIVACAO')
 * @param usuarioResponsavel  quem fez. Enquanto nao existe login na aplicacao,
 *                            usamos 'cliente-<id>', que e a informacao honesta
 *                            que temos: quem agiu foi o proprio cliente.
 * @param detalhes            resumo legivel, com o requisito atendido
 *
 * A chamada acontece DEPOIS que a operacao principal deu certo. Assim a trilha
 * so registra o que realmente aconteceu: uma tentativa que falhou nao gera
 * linha de auditoria.
 */
async function registrar(entidade, entidadeId, operacao, usuarioResponsavel, detalhes) {
    await consultar(
        `INSERT INTO tb_auditoria
             (entidade, entidade_id, operacao, usuario_responsavel, data_hora, detalhes)
         VALUES ($1, $2, $3, $4, NOW(), $5)`,
        [entidade, entidadeId, operacao, usuarioResponsavel, detalhes]
    );
}

module.exports = { registrar };
