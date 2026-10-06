// =============================================================================
// DRS_LES_2_2026 - Criação de Pedido (RF0031 a RF0038)
//
// Cada teste cobre um item do roteiro mínimo da apresentação. O título traz
// entre colchetes o número do roteiro e os requisitos do DRS demonstrados.
//
// Todos os testes passam PELA TELA: clicam nos mesmos botões que o professor
// vai ver sendo clicados na demonstração. O acesso direto ao banco (cy.task)
// aparece só para preparar cenário (criar cupom, ajustar estoque), nunca para
// verificar resultado.
// =============================================================================

describe('DRS_LES_2_2026 - Criação de Pedido (carrinho até finalização)', () => {
    const baseUrl = 'http://localhost:8080';

    // Produtos do seed usados nos testes. O Glide Control custa R$ 36,00 porque
    // 1 unidade entregue em SP dá frete de R$ 14,00 e total de R$ 50,00 --
    // exatamente o valor do exemplo da RN0036 no DRS.
    const GLIDE = { id: 7, nome: 'Nexus Glide Control', preco: 36 };   // total 1un/SP = R$ 50,00
    const TECLADO = { id: 1, nome: 'Nexus Strike Pro RGB' };            // total 1un/SP = R$ 913,00
    const HUB = { id: 8, nome: 'Nexus Hub USB-C' };
    const CONTROLE = { id: 6, nome: 'Nexus Grip Controller' };          // usado no teste de estoque

    const gerarCpf = () => String(Math.floor(10000000000 + Math.random() * 89999999999));
    const gerarEmail = () => `pedido.${Date.now()}.${Math.floor(Math.random() * 100000)}@nexus.com`;
    const gerarCodigoDeCupom = () => `CY${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // -------------------------------------------------------------------------
    // Alerts: gravamos todos e conferimos depois.
    //
    // Por que não asseverar dentro de cy.on('window:alert'): o handler vale para
    // TODOS os alerts seguintes do teste. Num fluxo que emite vários ("item
    // adicionado", "quantidade alterada", "pedido realizado"), o handler que
    // espera o primeiro texto falha quando chega o segundo -- e, pior, essa
    // falha estoura dentro do try/catch da aplicação, que a mascara com
    // "Erro de conexão.". Gravando a lista e conferindo no fim, cada teste
    // verifica o que lhe interessa sem atrapalhar os outros passos.
    // -------------------------------------------------------------------------
    let alertas = [];

    beforeEach(() => {
        alertas = [];
        cy.on('window:alert', (texto) => { alertas.push(texto); });
    });

    /** Espera (com repetição) até que algum alert do teste contenha o trecho. */
    function esperarAlerta(trecho) {
        cy.wrap(null, { log: false }).should(() => {
            expect(alertas.join(' || ')).to.contain(trecho);
        });
    }

    /**
     * Cria um cliente completo pela API e devolve { id, enderecoId, cartaoId }.
     *
     * É feito por API, e não pela tela, porque o cadastro de cliente é a fase
     * ANTERIOR do projeto -- já tem a sua própria suíte (crud-cliente.cy.js).
     * Aqui ele é só o ponto de partida, e cada teste ganha um cliente novo para
     * não depender do que os outros deixaram no carrinho.
     */
    function criarCliente() {
        return cy.request('POST', `${baseUrl}/api/clientes`, {
            nome: 'Cliente Pedido Cypress',
            genero: 'FEMININO',
            cpf: gerarCpf(),
            dataNascimento: '1997-05-10',
            telefoneTipo: 'CELULAR',
            telefoneDdd: '11',
            telefoneNumero: '988887777',
            email: gerarEmail(),
            senha: 'Senha@123',
            confirmacaoSenha: 'Senha@123',
            endereco: {
                nome: 'Casa',
                // RN0023 - composição obrigatória do endereço
                tipoResidencia: 'CASA',
                tipoLogradouro: 'RUA',
                logradouro: 'das Flores',
                numero: '123',
                bairro: 'Centro',
                cep: '01234-567',
                cidade: 'São Paulo',
                estado: 'SP',
                pais: 'Brasil',
                tipoEndereco: 'AMBOS'
            },
            cartao: {
                numero: '4111111111111111',
                nomeImpresso: 'CLIENTE CYPRESS',
                validade: '12/30',
                bandeira: 'Visa',
                codigoSeguranca: '123',
                preferencial: true
            }
        }).then((resposta) => ({
            id: resposta.body.id,
            enderecoId: resposta.body.enderecos[0].id,
            cartaoId: resposta.body.cartoes[0].id
        }));
    }

    /** Abre a loja já "logado" como o cliente informado. */
    function abrirLojaComo(clienteId) {
        cy.visit(baseUrl, {
            onBeforeLoad(win) {
                win.localStorage.setItem('clienteId', clienteId);
            }
        });
        // Espera o catálogo chegar do GET /api/produtos antes de qualquer clique.
        cy.get('#grade-produtos .produto-card').should('have.length.greaterThan', 0);
    }

    /** RF0031 / RF0032 - adiciona um produto ao carrinho com a quantidade dada. */
    function adicionarAoCarrinho(produtoId, quantidade) {
        cy.get(`#qtd-produto-${produtoId}`).clear().type(String(quantidade));
        cy.get(`#btn-add-${produtoId}`).click();
    }

    /** Abre o checkout e espera os dados carregarem. */
    function irParaOCheckout() {
        cy.contains('Carrinho / Checkout').click();
        cy.get('#corpo-carrinho .carrinho-item').should('have.length.greaterThan', 0);
        // O frete só aparece depois que o endereço padrão é selecionado.
        cy.get('#resumo-frete').should('not.have.text', '—');
    }

    /** Preenche uma linha de pagamento com um cartão do perfil e um valor. */
    function pagarComCartao(posicao, cartaoId, valor) {
        cy.get(`#cartao-linha-${posicao}`).select(`perfil:${cartaoId}`);
        cy.get(`#valor-linha-${posicao}`).clear().type(String(valor)).blur();
    }

    // =========================================================================
    it('[ROTEIRO 1] RF0031/RF0032 - Deve incluir mais de um produto no carrinho e alterar a quantidade', () => {
        cy.log('RF0031 (gerenciar carrinho) e RF0032 (quantidade na adição e na visualização).');

        criarCliente().then((cliente) => {
            abrirLojaComo(cliente.id);

            // RF0032, primeira metade: a quantidade é definida JÁ NA ADIÇÃO.
            adicionarAoCarrinho(GLIDE.id, 2);
            esperarAlerta('RF0031 atendido');
            adicionarAoCarrinho(HUB.id, 3);

            cy.get('#contador-carrinho').should('have.text', '5');

            irParaOCheckout();

            // Mais de um produto no carrinho (duas linhas distintas).
            cy.get('#corpo-carrinho .carrinho-item').should('have.length', 2);
            cy.get('#corpo-carrinho').should('contain.text', GLIDE.nome);
            cy.get('#corpo-carrinho').should('contain.text', HUB.nome);

            // 2 x R$ 36,00 + 3 x R$ 20,00 = R$ 132,00
            cy.get('#resumo-subtotal').should('have.text', 'R$ 132,00');

            // RF0032, segunda metade: alterar a quantidade na VISUALIZAÇÃO.
            cy.get('#corpo-carrinho .carrinho-item').first().find('input[type=number]')
                .clear().type('1').blur();

            // 1 x R$ 36,00 + 3 x R$ 20,00 = R$ 96,00
            cy.get('#resumo-subtotal').should('have.text', 'R$ 96,00');

            // RF0031 - excluir um item do carrinho.
            cy.window().then((win) => cy.stub(win, 'confirm').returns(true));
            cy.get('#corpo-carrinho .carrinho-item').first().find('button').click();
            cy.get('#corpo-carrinho .carrinho-item').should('have.length', 1);
            cy.get('#resumo-subtotal').should('have.text', 'R$ 60,00');
        });
    });

    // =========================================================================
    it('[RN0031] Não deve permitir adicionar item acima da quantidade em estoque', () => {
        cy.log('RN0031 - validação de estoque na adição ao carrinho.');

        cy.task('definirEstoque', { produtoId: CONTROLE.id, quantidade: 3 });

        criarCliente().then((cliente) => {
            abrirLojaComo(cliente.id);

            // O campo de quantidade já limita pelo estoque, então digitamos
            // acima do máximo para provar que o SERVIDOR também recusa.
            cy.get(`#qtd-produto-${CONTROLE.id}`).clear().type('9');

            cy.get(`#btn-add-${CONTROLE.id}`).click();
            esperarAlerta('apenas 3');

            // Nada entrou no carrinho.
            cy.get('#contador-carrinho').should('have.text', '0');
        });
    });

    // =========================================================================
    it('[ROTEIRO 2 e 7] RF0033/RF0034/RF0038 - Compra com endereço e cartão já cadastrados', () => {
        cy.log('RF0033 (realizar compra), RF0034 (frete), RF0038 (status EM PROCESSAMENTO).');

        criarCliente().then((cliente) => {
            abrirLojaComo(cliente.id);
            adicionarAoCarrinho(GLIDE.id, 1);
            irParaOCheckout();

            // RF0034 - frete de SP com 1 item: R$ 10,00 da região + R$ 4,00 do item.
            cy.get('#resumo-subtotal').should('have.text', 'R$ 36,00');
            cy.get('#resumo-frete').should('have.text', 'R$ 14,00');
            cy.get('#resumo-total').should('have.text', 'R$ 50,00');

            // RF0035 - o endereço do perfil já vem selecionado.
            cy.get(`#endereco-${cliente.enderecoId}`).should('be.checked');

            // RF0036 - cartão do perfil paga o total.
            pagarComCartao(0, cliente.cartaoId, 50);
            cy.get('#falta-pagar').should('have.text', 'R$ 0,00');

            cy.get('#btn-finalizar-compra').click();

            // [ROTEIRO 7] RF0038 - pedido registrado com status EM PROCESSAMENTO.
            cy.get('#pedido-confirmado').should('not.have.class', 'hidden-view');
            cy.get('#pedido-status').should('have.text', 'EM PROCESSAMENTO');
            cy.get('#pedido-numero').should('not.have.text', '');
            cy.get('#pedido-resumo').should('contain.text', GLIDE.nome);
            cy.get('#pedido-resumo').should('contain.text', 'Visa final 1111');
            // Sem cupons, não há cupom de troca (RN0036).
            cy.get('#pedido-cupom-troca').should('have.class', 'hidden-view');
        });
    });

    // =========================================================================
    it('[ROTEIRO 3] RF0035/RF0036/RN0023 - Compra com endereço e cartão NOVOS, incorporados ao perfil', () => {
        cy.log('RF0035 e RF0036 - cadastrar endereço e cartão durante a compra e incorporá-los ao perfil.');

        criarCliente().then((cliente) => {
            abrirLojaComo(cliente.id);
            adicionarAoCarrinho(GLIDE.id, 1);
            irParaOCheckout();

            // --- RF0035 / RN0023: endereço novo durante a compra -------------
            cy.get('#btn-novo-endereco').click();
            cy.get('#novo-end-nome').type('Trabalho');
            cy.get('#novo-end-tipo-residencia').select('APARTAMENTO');
            cy.get('#novo-end-tipo-logradouro').select('AVENIDA');
            cy.get('#novo-end-logradouro').type('Paulista');
            cy.get('#novo-end-numero').type('1000');
            cy.get('#novo-end-complemento').type('Sala 45');
            cy.get('#novo-end-bairro').type('Bela Vista');
            cy.get('#novo-end-cep').type('01310-100');
            cy.get('#novo-end-cidade').type('São Paulo');
            cy.get('#novo-end-estado').type('SP');
            // Marcado = incorporar ao perfil do cliente.
            cy.get('#novo-end-salvar').check();
            cy.get('#btn-usar-novo-endereco').click();

            // --- RF0036 / RN0024: cartão novo durante a compra ---------------
            cy.get('#btn-novo-cartao').click();
            cy.get('#novo-cartao-numero').type('5555666677778888');
            cy.get('#novo-cartao-nome').type('CLIENTE CYPRESS');
            cy.get('#novo-cartao-bandeira').select('Mastercard');
            cy.get('#novo-cartao-validade').type('08/29');
            cy.get('#novo-cartao-cvv').type('321');
            cy.get('#novo-cartao-salvar').check();
            cy.get('#btn-usar-novo-cartao').click();

            cy.get('#valor-linha-0').clear().type('50').blur();
            cy.get('#falta-pagar').should('have.text', 'R$ 0,00');

            cy.get('#btn-finalizar-compra').click();

            cy.get('#pedido-status').should('have.text', 'EM PROCESSAMENTO');
            cy.get('#pedido-resumo').should('contain.text', 'Trabalho');
            cy.get('#pedido-resumo').should('contain.text', 'AVENIDA Paulista');
            cy.get('#pedido-resumo').should('contain.text', 'Mastercard final 8888');

            // O endereço e o cartão foram mesmo INCORPORADOS ao perfil: a prova
            // é que agora aparecem na Área do Cliente.
            cy.contains('Área do Cliente').click();
            cy.get('#corpo-lista-enderecos').should('contain.text', 'Trabalho');
            cy.get('#corpo-lista-enderecos').should('contain.text', 'AVENIDA Paulista');
            cy.get('#corpo-lista-cartoes').should('contain.text', 'Mastercard');
            cy.get('#corpo-lista-cartoes').should('contain.text', '**** **** **** 8888');
        });
    });

    // =========================================================================
    it('[ROTEIRO 4] RN0034 - Pagamento com mais de um cartão, respeitando o mínimo de R$ 10,00', () => {
        cy.log('RN0034 - vários cartões por compra, mínimo de R$ 10,00 em cada um.');

        criarCliente().then((cliente) => {
            abrirLojaComo(cliente.id);
            adicionarAoCarrinho(TECLADO.id, 1);
            irParaOCheckout();

            // R$ 899,00 + R$ 14,00 de frete = R$ 913,00
            cy.get('#resumo-total').should('have.text', 'R$ 913,00');

            // Ao escolher UM cartão, ele já recebe o valor inteiro da compra.
            cy.get('#cartao-linha-0').select(`perfil:${cliente.cartaoId}`);
            cy.get('#valor-linha-0').should('have.value', '913');

            // Ao adicionar o segundo, o valor é dividido igualmente entre eles.
            cy.get('#btn-adicionar-linha-cartao').click();
            cy.get('#cartao-linha-1').select(`perfil:${cliente.cartaoId}`);
            cy.get('#valor-linha-0').should('have.value', '456.5');
            cy.get('#valor-linha-1').should('have.value', '456.5');
            cy.get('#falta-pagar').should('have.text', 'R$ 0,00');

            // Mas o cliente continua podendo ajustar à mão. Aqui a tentativa
            // INVÁLIDA: R$ 905,00 + R$ 8,00 — sem cupons, a RN0034 exige
            // R$ 10,00 em cada cartão.
            cy.get('#valor-linha-0').clear().type('905').blur();
            cy.get('#valor-linha-1').clear().type('8').blur();

            cy.get('#btn-finalizar-compra').click();
            esperarAlerta('R$ 10,00');

            // A compra NÃO foi concluída: continuamos no checkout.
            cy.get('#pedido-confirmado').should('have.class', 'hidden-view');

            // Agora a divisão VÁLIDA: R$ 500,00 + R$ 413,00, ambos acima do mínimo.
            cy.get('#valor-linha-0').clear().type('500').blur();
            cy.get('#valor-linha-1').clear().type('413').blur();
            cy.get('#falta-pagar').should('have.text', 'R$ 0,00');

            cy.get('#btn-finalizar-compra').click();

            cy.get('#pedido-status').should('have.text', 'EM PROCESSAMENTO');
            // Os dois cartões aparecem no resumo do pedido.
            cy.get('#pedido-resumo').should('contain.text', 'R$ 500,00');
            cy.get('#pedido-resumo').should('contain.text', 'R$ 413,00');
        });
    });

    // =========================================================================
    it('[ROTEIRO 5] RN0035 - Pagamento com cupom e cartão, com valor inferior a R$ 10,00 no cartão', () => {
        cy.log('RN0035 - com cupons, o que resta pode ficar abaixo de R$ 10,00 no cartão.');

        criarCliente().then((cliente) => {
            const cupom = gerarCodigoDeCupom();
            // Compra de R$ 50,00: cupom de R$ 45,00 deixa R$ 5,00 para o cartão.
            cy.task('criarCupom', { codigo: cupom, tipo: 'PROMOCIONAL', valor: 45.00 });

            abrirLojaComo(cliente.id);
            adicionarAoCarrinho(GLIDE.id, 1);
            irParaOCheckout();

            cy.get('#resumo-total').should('have.text', 'R$ 50,00');

            // RF0037 - o cupom entra como forma de pagamento.
            cy.get(`#cupom-${cupom}`).check();
            cy.get('#total-cupons').should('have.text', 'R$ 45,00');

            // RN0035 - R$ 5,00 no cartão, abaixo do mínimo da RN0034, é aceito
            // justamente porque há cupom na compra.
            pagarComCartao(0, cliente.cartaoId, 5);
            cy.get('#falta-pagar').should('have.text', 'R$ 0,00');

            cy.get('#btn-finalizar-compra').click();

            cy.get('#pedido-status').should('have.text', 'EM PROCESSAMENTO');
            cy.get('#pedido-resumo').should('contain.text', `Cupom ${cupom}`);
            cy.get('#pedido-resumo').should('contain.text', 'R$ 45,00');
            cy.get('#pedido-resumo').should('contain.text', 'R$ 5,00');
            // Os cupons não superaram a compra, então não há troco.
            cy.get('#pedido-cupom-troca').should('have.class', 'hidden-view');
        });
    });

    // =========================================================================
    it('[ROTEIRO 6] RN0036 - Cupons que superam a compra geram cupom de troca com a diferença', () => {
        cy.log('RN0036 - exemplo literal do DRS: compra de R$ 50,00 com cupons de R$ 20,00 e R$ 40,00.');

        criarCliente().then((cliente) => {
            // Cupons de TROCA (e não promocionais) porque a RN0033 só permite um
            // promocional por compra -- com dois promocionais a recusa viria
            // dela, e não da RN0036 que queremos demonstrar aqui.
            const cupom20 = gerarCodigoDeCupom() + 'A';
            const cupom40 = gerarCodigoDeCupom() + 'B';
            cy.task('criarCupom', { codigo: cupom20, tipo: 'TROCA', valor: 20.00, clienteId: cliente.id });
            cy.task('criarCupom', { codigo: cupom40, tipo: 'TROCA', valor: 40.00, clienteId: cliente.id });

            abrirLojaComo(cliente.id);
            adicionarAoCarrinho(GLIDE.id, 1);
            irParaOCheckout();

            cy.get('#resumo-total').should('have.text', 'R$ 50,00');

            // R$ 20,00 + R$ 40,00 = R$ 60,00 para uma compra de R$ 50,00.
            cy.get(`#cupom-${cupom20}`).check();
            cy.get(`#cupom-${cupom40}`).check();
            cy.get('#total-cupons').should('have.text', 'R$ 60,00');

            // Nenhum cartão: os cupons cobrem tudo.
            cy.get('#btn-finalizar-compra').click();

            cy.get('#pedido-status').should('have.text', 'EM PROCESSAMENTO');

            // RN0036 - a diferença de R$ 10,00 virou um cupom de troca.
            cy.get('#pedido-cupom-troca').should('not.have.class', 'hidden-view');
            cy.get('#pedido-cupom-troca-valor').should('have.text', 'R$ 10,00');
            cy.get('#pedido-cupom-troca-codigo').invoke('text').should('match', /^TROCA-\d+$/);

            // O cupom gerado fica disponível para a próxima compra do cliente.
            cy.get('#pedido-cupom-troca-codigo').invoke('text').then((codigoGerado) => {
                cy.request(`${baseUrl}/api/pedidos/${cliente.id}/cupons`).then((resposta) => {
                    expect(resposta.body.some((c) => c.codigo === codigoGerado.trim())).to.be.true;
                });
            });
        });
    });

    // =========================================================================
    it('[RN0036] Não deve permitir o uso de cupons desnecessários', () => {
        cy.log('RN0036 - exemplo do DRS: para uma compra de R$ 50,00, os cupons de 20, 40 e 35 juntos são recusados.');

        criarCliente().then((cliente) => {
            const c20 = gerarCodigoDeCupom() + 'C';
            const c40 = gerarCodigoDeCupom() + 'D';
            const c35 = gerarCodigoDeCupom() + 'E';
            cy.task('criarCupom', { codigo: c20, tipo: 'TROCA', valor: 20.00, clienteId: cliente.id });
            cy.task('criarCupom', { codigo: c40, tipo: 'TROCA', valor: 40.00, clienteId: cliente.id });
            cy.task('criarCupom', { codigo: c35, tipo: 'TROCA', valor: 35.00, clienteId: cliente.id });

            abrirLojaComo(cliente.id);
            adicionarAoCarrinho(GLIDE.id, 1);
            irParaOCheckout();

            // Os três somam R$ 95,00 para uma compra de R$ 50,00: tirando o de
            // R$ 20,00 ainda sobrariam R$ 75,00, logo ele é desnecessário.
            cy.get(`#cupom-${c20}`).check();
            cy.get(`#cupom-${c40}`).check();
            cy.get(`#cupom-${c35}`).check();

            cy.get('#btn-finalizar-compra').click();
            esperarAlerta('desnecessário');

            // A compra foi recusada: seguimos no checkout.
            cy.get('#pedido-confirmado').should('have.class', 'hidden-view');
        });
    });

    // =========================================================================
    it('[UX] Deve dividir o valor entre os cartões e permitir ajuste manual', () => {
        cy.log('Ao escolher um cartão ele recebe o total; ao adicionar outros, o valor é dividido igualmente.');

        criarCliente().then((cliente) => {
            abrirLojaComo(cliente.id);
            adicionarAoCarrinho(GLIDE.id, 1);   // total R$ 50,00
            irParaOCheckout();

            cy.get('#resumo-total').should('have.text', 'R$ 50,00');

            // Um cartão: fica com o valor inteiro.
            cy.get('#cartao-linha-0').select(`perfil:${cliente.cartaoId}`);
            cy.get('#valor-linha-0').should('have.value', '50');
            cy.get('#falta-pagar').should('have.text', 'R$ 0,00');

            // Dois cartões: metade para cada.
            cy.get('#btn-adicionar-linha-cartao').click();
            cy.get('#cartao-linha-1').select(`perfil:${cliente.cartaoId}`);
            cy.get('#valor-linha-0').should('have.value', '25');
            cy.get('#valor-linha-1').should('have.value', '25');

            // Três cartões: R$ 50,00 não divide exato por 3. A sobra de centavos
            // vai para os primeiros, e a soma continua fechando em R$ 50,00.
            cy.get('#btn-adicionar-linha-cartao').click();
            cy.get('#cartao-linha-2').select(`perfil:${cliente.cartaoId}`);
            cy.get('#valor-linha-0').should('have.value', '16.67');
            cy.get('#valor-linha-1').should('have.value', '16.67');
            cy.get('#valor-linha-2').should('have.value', '16.66');
            cy.get('#falta-pagar').should('have.text', 'R$ 0,00');

            // Removendo um, os dois restantes voltam a dividir pela metade.
            cy.get('#linhas-pagamento .linha-pagamento').last().find('button').click();
            cy.get('#valor-linha-0').should('have.value', '25');
            cy.get('#valor-linha-1').should('have.value', '25');

            // O ajuste manual é respeitado: digitar num cartão não redistribui
            // o outro.
            cy.get('#valor-linha-0').clear().type('40').blur();
            cy.get('#valor-linha-1').should('have.value', '25');
            cy.get('#falta-pagar').should('have.text', 'R$ 15,00 a mais');
        });
    });

    // =========================================================================
    it('[UX] Deve mostrar o desconto do cupom e o valor a pagar no resumo', () => {
        cy.log('O resumo passa a mostrar o desconto dos cupons e quanto sobra para pagar.');

        criarCliente().then((cliente) => {
            const cupom = gerarCodigoDeCupom() + 'H';
            cy.task('criarCupom', { codigo: cupom, tipo: 'PROMOCIONAL', valor: 30.00 });

            abrirLojaComo(cliente.id);
            adicionarAoCarrinho(GLIDE.id, 1);   // total R$ 50,00
            irParaOCheckout();

            // Sem cupom, as linhas de desconto ficam escondidas.
            cy.get('#linha-desconto').should('have.class', 'hidden-view');
            cy.get('#linha-a-pagar').should('have.class', 'hidden-view');

            cy.get(`#cupom-${cupom}`).check();

            cy.get('#resumo-subtotal').should('have.text', 'R$ 36,00');
            cy.get('#resumo-frete').should('have.text', 'R$ 14,00');
            cy.get('#resumo-total').should('have.text', 'R$ 50,00');
            cy.get('#linha-desconto').should('not.have.class', 'hidden-view');
            cy.get('#resumo-desconto').should('have.text', '− R$ 30,00');
            cy.get('#resumo-a-pagar').should('have.text', 'R$ 20,00');

            // O cartão já recebe automaticamente o que sobrou depois do cupom.
            cy.get('#cartao-linha-0').select(`perfil:${cliente.cartaoId}`);
            cy.get('#valor-linha-0').should('have.value', '20');

            // Desmarcando o cupom, o resumo volta ao estado anterior.
            cy.get(`#cupom-${cupom}`).uncheck();
            cy.get('#linha-desconto').should('have.class', 'hidden-view');
            cy.get('#valor-linha-0').should('have.value', '50');
        });
    });

    // =========================================================================
    it('[UX] Deve avisar no resumo quando os cupons superam o total (RN0036)', () => {
        criarCliente().then((cliente) => {
            const cupom = gerarCodigoDeCupom() + 'I';
            cy.task('criarCupom', { codigo: cupom, tipo: 'TROCA', valor: 70.00, clienteId: cliente.id });

            abrirLojaComo(cliente.id);
            adicionarAoCarrinho(GLIDE.id, 1);   // total R$ 50,00
            irParaOCheckout();

            cy.get(`#cupom-${cupom}`).check();

            // O desconto exibido é limitado ao total da compra.
            cy.get('#resumo-desconto').should('have.text', '− R$ 50,00');
            cy.get('#resumo-a-pagar').should('have.text', 'R$ 0,00');
            // E o excedente é anunciado como futuro cupom de troca.
            cy.get('#linha-troco').should('not.have.class', 'hidden-view');
            cy.get('#resumo-troco').should('have.text', 'R$ 20,00');
        });
    });

    // =========================================================================
    it('[UX] A Área do Cliente deve listar os cupons reais, iguais aos do carrinho', () => {
        cy.log('A seção "Meus Cupons Disponíveis" agora vem do banco, não do HTML.');

        criarCliente().then((cliente) => {
            const promocional = gerarCodigoDeCupom() + 'J';
            const deTroca = gerarCodigoDeCupom() + 'K';
            cy.task('criarCupom', { codigo: promocional, tipo: 'PROMOCIONAL', valor: 25.00 });
            cy.task('criarCupom', { codigo: deTroca, tipo: 'TROCA', valor: 12.50, clienteId: cliente.id });

            abrirLojaComo(cliente.id);
            cy.contains('Área do Cliente').click();

            cy.get('#meus-cupons .cupom-disponivel').should('have.length.greaterThan', 1);
            cy.get('#meus-cupons').should('contain.text', promocional);
            cy.get('#meus-cupons').should('contain.text', 'R$ 25,00');
            cy.get('#meus-cupons').should('contain.text', deTroca);
            cy.get('#meus-cupons').should('contain.text', 'R$ 12,50');
            cy.get('#meus-cupons').should('contain.text', 'Cupom de troca');

            // Os cupons inventados que existiam no HTML não podem mais aparecer.
            cy.get('#meus-cupons').should('not.contain.text', 'FRETEGRATIS');
            cy.get('#meus-cupons').should('not.contain.text', 'NIVER20');
        });
    });

    // =========================================================================
    it('[UX] Cada produto da loja deve exibir sua ilustração', () => {
        criarCliente().then((cliente) => {
            abrirLojaComo(cliente.id);

            // Os 8 produtos têm imagem, e nenhuma caiu no ícone de reserva.
            cy.get('#grade-produtos .produto-card img').should('have.length', 8);
            cy.get('#grade-produtos .produto-card img').each(($img) => {
                // naturalWidth > 0 prova que o arquivo foi mesmo carregado, e
                // não que o <img> existe apontando para um caminho quebrado.
                expect($img[0].naturalWidth).to.be.greaterThan(0);
                expect($img.attr('src')).to.contain('imagens/produtos/');
            });
        });
    });

    // =========================================================================
    it('[RN0033] Não deve permitir mais de um cupom promocional por compra', () => {
        cy.log('RN0033 - apenas um cupom promocional por compra.');

        criarCliente().then((cliente) => {
            const promo1 = gerarCodigoDeCupom() + 'F';
            const promo2 = gerarCodigoDeCupom() + 'G';
            cy.task('criarCupom', { codigo: promo1, tipo: 'PROMOCIONAL', valor: 15.00 });
            cy.task('criarCupom', { codigo: promo2, tipo: 'PROMOCIONAL', valor: 15.00 });

            abrirLojaComo(cliente.id);
            adicionarAoCarrinho(GLIDE.id, 1);
            irParaOCheckout();

            cy.get(`#cupom-${promo1}`).check();
            cy.get(`#cupom-${promo2}`).check();
            pagarComCartao(0, cliente.cartaoId, 20);

            cy.get('#btn-finalizar-compra').click();
            esperarAlerta('RN0033');

            cy.get('#pedido-confirmado').should('have.class', 'hidden-view');
        });
    });
});
