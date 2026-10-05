// =============================================================================
// Validacao dos dados que chegam nas requisicoes.
//
// No backend antigo isso eram anotacoes (@NotBlank, @Email, @Past, @Pattern)
// que o Spring lia por reflexao, em tempo de execucao. Funcionava, mas para
// descobrir por que um cadastro foi recusado era preciso saber como o
// framework interpreta cada anotacao.
//
// Aqui sao ifs. Da para ler de cima a baixo e saber exatamente qual regra
// reprova qual campo, e com qual mensagem o usuario vai ver na tela.
// =============================================================================

// --- Valores aceitos: os mesmos CHECKs que existem no schema.sql -------------
// Validamos aqui tambem, e nao so no banco, porque o erro do Postgres para um
// CHECK violado e tecnico ("violates check constraint tb_cliente_genero_check")
// e nao serve para mostrar ao usuario.
const GENEROS = ['MASCULINO', 'FEMININO', 'OUTRO'];
const TIPOS_DE_TELEFONE = ['RESIDENCIAL', 'COMERCIAL', 'CELULAR'];
const TIPOS_DE_ENDERECO = ['COBRANCA', 'ENTREGA', 'AMBOS'];

// RNF0031 - minimo 8 caracteres, com minuscula, maiuscula e caractere especial.
// E a mesma expressao do backend antigo, mantida caractere por caractere.
// Lendo por partes: (?=.*[a-z]) exige que em algum lugar exista uma minuscula,
// (?=.*[A-Z]) uma maiuscula, (?=.*[!@#...]) um caractere especial, e .{8,}
// exige 8 ou mais caracteres no total.
const REGRA_DE_SENHA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>_\-]).{8,}$/;
const MENSAGEM_DE_SENHA =
    'A senha deve ter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas e um caractere especial.';

// Formato de e-mail: algo, arroba, algo, ponto, algo, sem espacos. Nao prova
// que o e-mail existe (so enviar uma mensagem provaria), mas pega erro de
// digitacao, que e o caso real no cadastro.
const REGRA_DE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Cria um erro de regra de negocio: algo que o USUARIO fez errado, como CPF
 * duplicado, senha fraca ou cliente inexistente.
 *
 * A marca regraDeNegocio existe para o server.js saber a diferenca entre
 * "o usuario errou" (responder 400 e mostrar a mensagem na tela) e "a
 * aplicacao quebrou" (responder 500 e nao vazar detalhes internos do banco).
 * No backend antigo esse papel era do IllegalArgumentException, que o
 * GlobalExceptionHandler reconhecia.
 */
function erroDeRegra(mensagem) {
    const erro = new Error(mensagem);
    erro.regraDeNegocio = true;
    return erro;
}

/** Campo ausente, nulo, ou so com espacos: o equivalente do @NotBlank. */
function vazio(valor) {
    return valor === undefined || valor === null || String(valor).trim() === '';
}

/**
 * Data de hoje no formato AAAA-MM-DD.
 *
 * Trabalhamos com datas como texto nesse formato de proposito: comparar
 * 1995-06-20 < 2026-10-05 como texto da o mesmo resultado que comparar as
 * datas de verdade, porque o formato vai do ano para o dia. Isso evita o
 * objeto Date do JavaScript, que interpreta datas em fuso horario e faria um
 * nascimento em 20/06 virar 19/06 dependendo da hora em que o codigo roda.
 */
function hoje() {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return agora.getFullYear() + '-' + mes + '-' + dia;
}

// -----------------------------------------------------------------------------
// As funcoes errosDe... JUNTAM mensagens numa lista em vez de parar no primeiro
// problema. Assim o usuario recebe de uma vez tudo que precisa corrigir, e nao
// um campo por tentativa.
// -----------------------------------------------------------------------------

/** Campos de telefone, usados tanto no cadastro quanto na alteracao. */
function errosDeTelefone(dados) {
    const erros = [];
    if (vazio(dados.telefoneTipo)) {
        erros.push('O tipo de telefone é obrigatório.');
    } else if (!TIPOS_DE_TELEFONE.includes(dados.telefoneTipo)) {
        erros.push('O tipo de telefone deve ser um destes: ' + TIPOS_DE_TELEFONE.join(', ') + '.');
    }
    if (vazio(dados.telefoneDdd)) erros.push('O DDD é obrigatório.');
    if (vazio(dados.telefoneNumero)) erros.push('O número de telefone é obrigatório.');
    return erros;
}

/** Dados pessoais, usados no cadastro (RF0021) e na alteracao (RF0022). */
function errosDeDadosPessoais(dados) {
    const erros = [];

    if (vazio(dados.nome)) erros.push('O nome é obrigatório.');

    if (vazio(dados.genero)) {
        erros.push('O gênero é obrigatório.');
    } else if (!GENEROS.includes(dados.genero)) {
        erros.push('O gênero deve ser um destes: ' + GENEROS.join(', ') + '.');
    }

    if (vazio(dados.dataNascimento)) {
        erros.push('A data de nascimento é obrigatória.');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.dataNascimento)) {
        erros.push('A data de nascimento deve estar no formato AAAA-MM-DD.');
    } else if (dados.dataNascimento >= hoje()) {
        erros.push('A data de nascimento deve estar no passado.');
    }

    erros.push(...errosDeTelefone(dados));

    if (vazio(dados.email)) {
        erros.push('O e-mail é obrigatório.');
    } else if (!REGRA_DE_EMAIL.test(dados.email)) {
        erros.push('Formato de e-mail inválido.');
    }

    return erros;
}

/** RN0026 - campos obrigatorios de um endereco. */
function errosDeEndereco(endereco) {
    if (!endereco) return ['É obrigatório informar ao menos um endereço.'];

    const erros = [];
    if (vazio(endereco.nome)) erros.push('A identificação do endereço é obrigatória.');
    if (vazio(endereco.logradouro)) erros.push('O logradouro é obrigatório.');
    if (vazio(endereco.numero)) erros.push('O número é obrigatório.');
    if (vazio(endereco.bairro)) erros.push('O bairro é obrigatório.');
    if (vazio(endereco.cep)) erros.push('O CEP é obrigatório.');
    if (vazio(endereco.cidade)) erros.push('A cidade é obrigatória.');
    if (vazio(endereco.estado)) erros.push('O estado é obrigatório.');
    if (vazio(endereco.pais)) erros.push('O país é obrigatório.');

    // tipoEndereco e opcional: quando nao vem, as rotas assumem AMBOS. Mas se
    // vier, tem que ser um dos tres valores que o banco aceita.
    if (!vazio(endereco.tipoEndereco) && !TIPOS_DE_ENDERECO.includes(endereco.tipoEndereco)) {
        erros.push('O tipo de endereço deve ser um destes: ' + TIPOS_DE_ENDERECO.join(', ') + '.');
    }

    // complemento e observacoes sao os unicos campos realmente opcionais.
    return erros;
}

/** RF0027 - campos obrigatorios de um cartao de credito. */
function errosDeCartao(cartao) {
    const erros = [];
    if (vazio(cartao.numero)) erros.push('O número do cartão é obrigatório.');
    if (vazio(cartao.nomeImpresso)) erros.push('O nome impresso no cartão é obrigatório.');
    if (vazio(cartao.validade)) erros.push('A data de validade do cartão é obrigatória.');
    if (vazio(cartao.bandeira)) erros.push('A bandeira do cartão é obrigatória.');
    if (vazio(cartao.codigoSeguranca)) erros.push('O código de segurança é obrigatório.');
    return erros;
}

/** Se a lista de problemas nao esta vazia, interrompe a requisicao com um 400. */
function reprovar(erros) {
    if (erros.length > 0) throw erroDeRegra(erros.join(' '));
}

// -----------------------------------------------------------------------------
// As cinco funcoes abaixo sao as que as rotas chamam. Cada uma corresponde a um
// DTO do backend antigo (ClienteRequest, ClienteAlterarRequest, EnderecoRequest,
// CartaoCreditoRequest, AlterarSenhaRequest) e, se algo estiver errado,
// interrompe a requisicao ali mesmo: a rota nunca executa com dado invalido.
// -----------------------------------------------------------------------------

/** RF0021 / RN0026 - cadastro: dados pessoais + endereco + cartao opcional. */
function validarCadastroDeCliente(dados) {
    const erros = errosDeDadosPessoais(dados);

    if (vazio(dados.cpf)) erros.push('O CPF é obrigatório.');

    if (vazio(dados.senha)) {
        erros.push('A senha é obrigatória.');
    } else if (!REGRA_DE_SENHA.test(dados.senha)) {
        erros.push(MENSAGEM_DE_SENHA);
    }
    if (vazio(dados.confirmacaoSenha)) erros.push('A confirmação de senha é obrigatória.');

    // RN0021 + RN0022 - o cadastro nao fecha sem pelo menos um endereco.
    erros.push(...errosDeEndereco(dados.endereco));

    // O cartao e opcional neste momento (RF0027 tem fluxo proprio depois). Mas
    // se o cliente comecou a preencher, os campos tem que estar completos.
    if (dados.cartao) erros.push(...errosDeCartao(dados.cartao));

    reprovar(erros);
}

/**
 * RF0022 - alteracao de dados cadastrais.
 *
 * Nao valida CPF (e a identidade do cliente, nao muda), nem senha, nem
 * enderecos/cartoes: cada um tem seu proprio fluxo, porque o RNF0034 exige que
 * seja possivel alterar uma coisa sem reenviar todas as outras.
 */
function validarAlteracaoDeCliente(dados) {
    reprovar(errosDeDadosPessoais(dados));
}

/** RF0028 / RNF0031 - troca de senha isolada. */
function validarNovaSenha(dados) {
    const erros = [];
    if (vazio(dados.novaSenha)) {
        erros.push('A nova senha é obrigatória.');
    } else if (!REGRA_DE_SENHA.test(dados.novaSenha)) {
        erros.push(MENSAGEM_DE_SENHA);
    }
    if (vazio(dados.confirmacaoSenha)) erros.push('A confirmação de senha é obrigatória.');
    reprovar(erros);
}

/** RF0026 - endereco enviado sozinho (adicionar ou alterar um endereco). */
function validarEndereco(dados) {
    reprovar(errosDeEndereco(dados));
}

/** RF0027 - cartao enviado sozinho. */
function validarCartao(dados) {
    reprovar(errosDeCartao(dados || {}));
}

module.exports = {
    erroDeRegra,
    validarCadastroDeCliente,
    validarAlteracaoDeCliente,
    validarNovaSenha,
    validarEndereco,
    validarCartao
};
