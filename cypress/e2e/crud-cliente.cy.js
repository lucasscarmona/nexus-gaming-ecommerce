// Suite de testes automatizados de interface do CRUD de Cliente.
// Os IDs entre colchetes no título de cada teste são os IDs reais do
// DRS_LES_1_2026.pdf (grupo "Cadastro de Clientes") que aquele teste valida.

describe('DRS_LES_1_2026 - Modulo de Gestao de Clientes (CRUD completo)', () => {
    const baseUrl = 'http://localhost:8080';

    let clienteId;
    let clienteCpf;

    function gerarCpf() {
        return String(Math.floor(10000000000 + Math.random() * 89999999999));
    }

    function gerarEmail() {
        return `cypress.${Date.now()}.${Math.floor(Math.random() * 100000)}@nexus.com`;
    }

    function registrarClienteViaApi(overrides = {}) {
        const dados = {
            nome: 'Cliente Cypress',
            genero: 'FEMININO',
            cpf: gerarCpf(),
            dataNascimento: '1998-03-15',
            telefoneTipo: 'CELULAR',
            telefoneDdd: '11',
            telefoneNumero: '999990000',
            email: gerarEmail(),
            senha: 'Senha@123',
            confirmacaoSenha: 'Senha@123',
            endereco: {
                nome: 'Casa',
                logradouro: 'Rua das Flores',
                numero: '123',
                bairro: 'Centro',
                cep: '01234-567',
                cidade: 'Mogi das Cruzes',
                estado: 'SP',
                pais: 'Brasil',
                tipoEndereco: 'AMBOS'
            },
            cartao: null,
            ...overrides
        };
        return cy.request('POST', `${baseUrl}/api/clientes`, dados);
    }

    function visitarComoCliente() {
        cy.visit(baseUrl, {
            onBeforeLoad(win) {
                win.localStorage.setItem('clienteId', clienteId);
            }
        });
    }

    function preencherDadosCadastro({ cpf, email, senha, confirmarSenha }) {
        cy.get('#cad-nome').type('Cliente Teste RN');
        cy.get('#cad-genero').select('FEMININO');
        cy.get('#cad-cpf').type(cpf);
        cy.get('#cad-data').type('1995-06-20');
        cy.get('#cad-email').type(email);
        cy.get('#cad-tel-tipo').select('CELULAR');
        cy.get('#cad-tel-ddd').type('11');
        cy.get('#cad-tel-numero').type('999998888');
        cy.get('#cad-senha').type(senha);
        cy.get('#cad-confirmar-senha').type(confirmarSenha);
        cy.get('#cad-end-nome').type('Casa');
        cy.get('#cad-end-logradouro').type('Rua Teste');
        cy.get('#cad-end-numero').type('10');
        cy.get('#cad-end-bairro').type('Bairro Teste');
        cy.get('#cad-end-cep').type('00000-000');
        cy.get('#cad-end-cidade').type('Cidade Teste');
        cy.get('#cad-end-estado').type('SP');
    }

    before(() => {
        // Cliente compartilhado pelos testes de alterar/senha/endereco/cartao/inativar,
        // criado direto via API para manter os testes de UI rápidos e focados.
        registrarClienteViaApi().then((resposta) => {
            clienteId = resposta.body.id;
            clienteCpf = resposta.body.cpf;
        });
    });

    it('[RF0021] Deve cadastrar um cliente com sucesso, incluindo endereço e cartão de crédito', () => {
        cy.log('Demonstrando RF0021 (Cadastrar cliente), RF0026 (endereço) e RF0027 (cartão) no mesmo fluxo de cadastro.');
        cy.visit(baseUrl);
        cy.contains('Cadastre-se').click();

        const cpfDinamico = gerarCpf();
        const emailDinamico = gerarEmail();

        cy.get('#cad-nome').type('Fernando Camargo');
        cy.get('#cad-genero').select('MASCULINO');
        cy.get('#cad-cpf').type(cpfDinamico);
        cy.get('#cad-data').type('2000-01-01');
        cy.get('#cad-email').type(emailDinamico);
        cy.get('#cad-tel-tipo').select('CELULAR');
        cy.get('#cad-tel-ddd').type('11');
        cy.get('#cad-tel-numero').type('988887777');
        cy.get('#cad-senha').type('Senha@123');
        cy.get('#cad-confirmar-senha').type('Senha@123');

        cy.get('#cad-end-nome').type('Casa');
        cy.get('#cad-end-logradouro').type('Avenida Vereador Narciso Yague Guimarães');
        cy.get('#cad-end-numero').type('100');
        cy.get('#cad-end-complemento').type('Bloco B, Apto 12');
        cy.get('#cad-end-bairro').type('Centro Cívico');
        cy.get('#cad-end-cep').type('08710-000');
        cy.get('#cad-end-cidade').type('Mogi das Cruzes');
        cy.get('#cad-end-estado').type('SP');

        cy.get('#cad-cartao-bandeira option').should('have.length.greaterThan', 1);
        cy.get('#cad-cartao-numero').type('1111 2222 3333 4444');
        cy.get('#cad-cartao-nome').type('FERNANDO C SILVA');
        cy.get('#cad-cartao-bandeira').select('Visa');
        cy.get('#cad-cartao-validade').type('12/30');
        cy.get('#cad-cartao-cvv').type('123');

        cy.on('window:alert', (texto) => {
            expect(texto).to.contain('RF0021 atendido');
        });

        cy.get('#btn-concluir-cadastro').click();
        cy.get('#view-cliente').should('not.have.class', 'hidden-view');
    });

    it('[RN0026 / RNF-formato] Não deve permitir cadastro com e-mail em formato inválido', () => {
        cy.log('Demonstrando validação de formato de dado obrigatório (RN0026 - e-mail).');
        cy.visit(baseUrl);
        cy.contains('Cadastre-se').click();

        cy.get('#cad-email').type('email-invalido-sem-arroba');
        cy.get('#cad-email:invalid').should('have.length', 1);
    });

    it('[RNF0031] Não deve permitir cadastro com senha fraca', () => {
        cy.log('Demonstrando RNF0031 - senha deve ter 8+ caracteres, maiúscula, minúscula e caractere especial.');
        cy.visit(baseUrl);
        cy.contains('Cadastre-se').click();
        preencherDadosCadastro({ cpf: gerarCpf(), email: gerarEmail(), senha: '123', confirmarSenha: '123' });

        cy.on('window:alert', (texto) => {
            expect(texto.toLowerCase()).to.contain('mínimo 8 caracteres');
        });
        cy.get('#btn-concluir-cadastro').click();
        cy.get('#view-cadastro').should('not.have.class', 'hidden-view');
    });

    it('[RNF0032] Não deve permitir cadastro quando a confirmação de senha diverge', () => {
        cy.log('Demonstrando RNF0032 - confirmação de senha obrigatória e deve conferir com a senha.');
        cy.visit(baseUrl);
        cy.contains('Cadastre-se').click();
        preencherDadosCadastro({ cpf: gerarCpf(), email: gerarEmail(), senha: 'Senha@123', confirmarSenha: 'Outra@456' });

        cy.on('window:alert', (texto) => {
            expect(texto.toLowerCase()).to.contain('não conferem');
        });
        cy.get('#btn-concluir-cadastro').click();
        cy.get('#view-cadastro').should('not.have.class', 'hidden-view');
    });

    it('[RN0026 - CPF único] Não deve permitir cadastro com CPF já cadastrado', () => {
        cy.log('Demonstrando unicidade de CPF ao tentar cadastrar um cliente com CPF já existente.');
        cy.visit(baseUrl);
        cy.contains('Cadastre-se').click();
        preencherDadosCadastro({ cpf: clienteCpf, email: gerarEmail(), senha: 'Senha@123', confirmarSenha: 'Senha@123' });

        cy.on('window:alert', (texto) => {
            expect(texto).to.contain('CPF já cadastrado');
        });
        cy.get('#btn-concluir-cadastro').click();
    });

    it('[RF0022] Deve permitir alteração de dados cadastrais do cliente', () => {
        cy.log('Demonstrando RF0022 (Alterar cliente) via PUT /api/clientes/{id}.');
        visitarComoCliente();
        cy.contains('Área do Cliente').click();
        cy.contains('Alterar Dados').click();

        // aguarda o carregamento assíncrono dos dados atuais do cliente antes de editar
        cy.get('#edit-data').should('not.have.value', '');

        cy.get('#edit-nome').clear().type('Cliente Cypress Atualizado');
        cy.get('#edit-tel-ddd').clear().type('21');
        cy.get('#edit-tel-numero').clear().type('988776655');

        cy.on('window:alert', (texto) => {
            expect(texto).to.contain('RF0022 atendido');
        });
        cy.get('#btn-salvar-edicao').click();
    });

    it('[RF0028 / RNF0034] Deve permitir alterar apenas a senha, sem exigir os demais dados cadastrais', () => {
        cy.log('Demonstrando RF0028 (alterar apenas senha) e RNF0034 (edição isolada, sem tocar nos demais dados).');
        visitarComoCliente();
        cy.contains('Área do Cliente').click();
        cy.contains('Alterar Dados').click();
        cy.get('#edit-data').should('not.have.value', '');

        cy.get('#senha-nova').type('NovaSenha@999');
        cy.get('#senha-confirmar').type('NovaSenha@999');

        cy.on('window:alert', (texto) => {
            expect(texto).to.contain('RF0028 atendido');
        });
        cy.get('#btn-salvar-senha').click();
    });

    it('[RF0026] Deve permitir associar mais de um endereço ao cliente', () => {
        cy.log('Demonstrando RF0026 - associação de múltiplos endereços a um cliente já cadastrado.');
        visitarComoCliente();
        cy.contains('Área do Cliente').click();

        cy.get('#end-nome').type('Trabalho');
        cy.get('#end-logradouro').type('Av Paulista');
        cy.get('#end-numero').type('1000');
        cy.get('#end-complemento').type('Sala 45');
        cy.get('#end-bairro').type('Bela Vista');
        cy.get('#end-cep').type('01310-100');
        cy.get('#end-cidade').type('São Paulo');
        cy.get('#end-estado').type('SP');
        cy.get('#end-tipo').select('COBRANCA');

        cy.on('window:alert', (texto) => {
            expect(texto).to.contain('RF0026 atendido');
        });
        cy.get('#btn-adicionar-endereco').click();

        cy.get('#corpo-lista-enderecos tr').should('have.length.at.least', 2);
    });

    it('[RF0027 / RN0025] Deve permitir associar um cartão de crédito, validando a bandeira', () => {
        cy.log('Demonstrando RF0027 (associação de cartão) e RN0025 (bandeira deve existir no domínio do sistema).');
        visitarComoCliente();
        cy.contains('Área do Cliente').click();

        cy.get('#cartao-bandeira option').should('have.length.greaterThan', 1);
        cy.get('#cartao-numero').type('5555 6666 7777 8888');
        cy.get('#cartao-nome').type('CLIENTE CYPRESS');
        cy.get('#cartao-bandeira').select('Mastercard');
        cy.get('#cartao-validade').type('08/29');
        cy.get('#cartao-cvv').type('321');

        cy.on('window:alert', (texto) => {
            expect(texto).to.contain('RF0027 atendido');
        });
        cy.get('#btn-adicionar-cartao').click();

        cy.get('#corpo-lista-cartoes').should('contain.text', 'Mastercard');
    });

    it('[RF0023] Deve realizar inativação lógica (soft delete) sem apagar o registro do banco', () => {
        cy.log('Demonstrando RF0023 - distinção entre inativação lógica (ativo=false) e exclusão física do registro.');
        visitarComoCliente();
        cy.contains('Área do Cliente').click();

        cy.window().then((win) => {
            cy.stub(win, 'confirm').returns(true);
        });

        cy.on('window:alert', (texto) => {
            expect(texto.toLowerCase()).to.include('inativada');
        });

        cy.get('#btn-inativar').click();

        cy.request('GET', `${baseUrl}/api/clientes?ativo=false`).then((resposta) => {
            expect(resposta.status).to.eq(200);
            expect(resposta.body.some((c) => c.id === clienteId)).to.be.true;
        });
    });

    it('[RF0024] Deve permitir consultar clientes através de um filtro definido pelo usuário', () => {
        cy.log('Demonstrando RF0024 - consulta de clientes por filtro (nome), combinável ou isolado.');
        const nomeUnico = `Cliente Busca ${Date.now()}`;

        registrarClienteViaApi({ nome: nomeUnico, cpf: gerarCpf(), email: gerarEmail() });

        cy.visit(baseUrl);
        cy.contains('Painel ADM').click();
        cy.get('#busca-nome').type(nomeUnico);
        cy.get('#btn-buscar-clientes').click();

        cy.get('#corpo-resultado-busca').should('contain.text', nomeUnico);
    });
});
