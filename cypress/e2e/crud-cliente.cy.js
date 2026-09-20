describe('Avaliação DVP & DRS - CRUD Completo de Cliente', () => {

    beforeEach(() => {
        cy.visit('http://localhost:8080')
    })

    it('[RF-01] Deve cadastrar um cliente com sucesso usando dados válidos', () => {
        cy.log('Demonstrando Requisito Funcional: Cadastro de Clientes');
        cy.contains('Cadastre-se').click();

        const cpfDinamico = '123' + Math.floor(Math.random() * 10000000) + '0';
        const emailDinamico = `fernando.${Date.now()}@nexus.com`;

        cy.get('#cad-nome').type('Fernando Camargo');
        cy.get('#cad-cpf').type(cpfDinamico);
        cy.get('#cad-data').type('2000-01-01');
        cy.get('#cad-email').type(emailDinamico);
        cy.get('#cad-tel').type('11988887777');
        cy.get('#btn-concluir-cadastro').click();

        cy.on('window:alert', (texto) => {
            expect(texto).to.contains('Conta criada com sucesso!');
        });
    })

    it('[RN-01] Não deve permitir cadastro com E-mail em formato inválido', () => {
        cy.log('Demonstrando Regra de Validação de Formato (RN / RNF)');
        cy.contains('Cadastre-se').click();

        cy.get('#cad-nome').type('Lucas Teste Falha');
        cy.get('#cad-cpf').type('11122233344');
        cy.get('#cad-data').type('2006-07-25');
        cy.get('#cad-email').type('email-invalido-sem-arroba');
        cy.get('#cad-tel').type('11999999999');

        cy.get('#cad-email:invalid').should('have.length', 1);
    })

    it('[RF-03 / RF-02] Deve permitir alteração de dados cadastrais do cliente', () => {
        cy.log('Demonstrando Requisito Funcional: Alteração de Dados (PUT /api/clientes/{id})');
        cy.contains('Área do Cliente').click();
        cy.contains('Alterar Dados').click();

        cy.get('#edit-nome').clear().type('Fernando Camargo Atualizado');
        cy.get('#edit-tel').clear().type('11977778888');
        cy.get('#btn-salvar-edicao').click();

        cy.on('window:alert', (texto) => {
            expect(texto).to.contains('Dados alterados com sucesso!');
        });
    })

    it('[RN-04] Deve realizar inativação lógica (soft delete) sem apagar o registo do banco', () => {
        cy.log('Demonstrando Regra de Negócio: Distinção entre Inativação Lógica (ativo = false) e Exclusão Física');
        cy.contains('Área do Cliente').click();

        cy.window().then((win) => {
            cy.stub(win, 'confirm').returns(true);
        });

        cy.on('window:alert', (texto) => {
            expect(texto.toLowerCase()).to.include('inativada');
        });

        cy.get('#btn-inativar').click();

        cy.request('GET', 'http://localhost:8080/api/clientes').then((response) => {
            expect(response.status).to.eq(200);
        });
    })

})