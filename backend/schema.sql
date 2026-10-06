-- =============================================================================
-- Estrutura do banco de dados do Nexus Gaming Gear.
--
-- Por que este arquivo existe: no backend antigo (Spring + Hibernate) as
-- tabelas eram criadas automaticamente a partir das anotacoes nas classes Java
-- (ddl-auto=update). Nunca existia um lugar onde se pudesse ler o banco.
-- Aqui o SQL e explicito: o que esta escrito abaixo e exatamente o que existe.
--
-- Todos os comandos usam IF NOT EXISTS, entao subir o servidor varias vezes nao
-- recria nem apaga nada -- os dados ja cadastrados sao preservados.
-- =============================================================================

-- Bandeiras de cartao aceitas pela loja. E uma tabela de dominio: o sistema le,
-- mas nunca cadastra por conta propria -- quem a popula e o seed.sql.
-- RN0025 depende dela: a bandeira informada num cartao precisa existir aqui.
CREATE TABLE IF NOT EXISTS tb_bandeira (
    id   BIGSERIAL    PRIMARY KEY,
    nome VARCHAR(60)  NOT NULL UNIQUE
);

-- Cliente -- a entidade central da aplicacao.
--
-- As colunas tipo/ddd/numero guardam o telefone. No Java isso era uma classe
-- separada (@Embeddable Telefone), mas no banco sempre foram tres colunas da
-- propria tb_cliente. Aqui elas aparecem como realmente sao, sem a classe
-- intermediaria que nao correspondia a nada fisico.
CREATE TABLE IF NOT EXISTS tb_cliente (
    id              BIGSERIAL     PRIMARY KEY,
    nome            VARCHAR(120)  NOT NULL,
    genero          VARCHAR(20)   NOT NULL CHECK (genero IN ('MASCULINO', 'FEMININO', 'OUTRO')),
    cpf             VARCHAR(14)   NOT NULL UNIQUE,
    data_nascimento DATE          NOT NULL,
    email           VARCHAR(120)  NOT NULL UNIQUE,
    -- Guarda o hash BCrypt, nunca a senha digitada (RNF0033). Ver rotas-clientes.js.
    senha           VARCHAR(255)  NOT NULL,
    tipo            VARCHAR(255)  CHECK (tipo IN ('RESIDENCIAL', 'COMERCIAL', 'CELULAR')),
    ddd             VARCHAR(255),
    numero          VARCHAR(255),
    -- ativo = FALSE e a "exclusao" de um cliente (RF0023 - soft delete). O
    -- registro nunca sai do banco: apagar o cliente levaria embora o historico
    -- de pedidos, as notas fiscais e a trilha de auditoria dele.
    ativo           BOOLEAN       NOT NULL DEFAULT TRUE
);

-- Enderecos do cliente. Sao varios por cliente (RF0026), por isso ficam em
-- tabela separada com cliente_id apontando de volta.
CREATE TABLE IF NOT EXISTS tb_endereco (
    id            BIGSERIAL     PRIMARY KEY,
    cliente_id    BIGINT        NOT NULL REFERENCES tb_cliente (id),
    nome          VARCHAR(60)   NOT NULL,
    logradouro    VARCHAR(150)  NOT NULL,
    numero        VARCHAR(20)   NOT NULL,
    complemento   VARCHAR(60),
    bairro        VARCHAR(80)   NOT NULL,
    cep           VARCHAR(12)   NOT NULL,
    cidade        VARCHAR(80)   NOT NULL,
    estado        VARCHAR(2)    NOT NULL,
    pais          VARCHAR(60)   NOT NULL,
    observacoes   VARCHAR(255),
    -- RN0021 (cobranca) + RN0022 (entrega). AMBOS cobre os dois casos quando o
    -- cliente usa o mesmo endereco para receber e para pagar.
    tipo_endereco VARCHAR(20)   NOT NULL CHECK (tipo_endereco IN ('COBRANCA', 'ENTREGA', 'AMBOS'))
);

-- Cartoes de credito do cliente (RF0027), tambem varios por cliente.
CREATE TABLE IF NOT EXISTS tb_cartao_credito (
    id               BIGSERIAL     PRIMARY KEY,
    cliente_id       BIGINT        NOT NULL REFERENCES tb_cliente (id),
    bandeira_id      BIGINT        NOT NULL REFERENCES tb_bandeira (id),
    numero           VARCHAR(19)   NOT NULL,
    nome_impresso    VARCHAR(120)  NOT NULL,
    validade         VARCHAR(5)    NOT NULL,
    codigo_seguranca VARCHAR(4)    NOT NULL,
    -- Exatamente um cartao do cliente e o preferencial: e o escolhido por
    -- padrao na hora da compra.
    preferencial     BOOLEAN       NOT NULL DEFAULT FALSE
);

-- RNF0012 - trilha de auditoria. Toda operacao de escrita (cadastro, alteracao,
-- troca de senha, inativacao) grava uma linha aqui dizendo quem fez o que e
-- quando. E um registro so de leitura: nada nesta tabela e alterado ou apagado.
CREATE TABLE IF NOT EXISTS tb_auditoria (
    id                  BIGSERIAL     PRIMARY KEY,
    entidade            VARCHAR(60)   NOT NULL,
    entidade_id         BIGINT        NOT NULL,
    operacao            VARCHAR(30)   NOT NULL,
    usuario_responsavel VARCHAR(60)   NOT NULL,
    data_hora           TIMESTAMP     NOT NULL,
    detalhes            VARCHAR(500)  NOT NULL
);

-- Indices nas chaves estrangeiras. Sem eles, listar os enderecos de UM cliente
-- obrigaria o Postgres a ler a tabela de enderecos inteira, linha por linha.
CREATE INDEX IF NOT EXISTS idx_endereco_cliente ON tb_endereco (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cartao_cliente   ON tb_cartao_credito (cliente_id);

-- =============================================================================
-- FASE 2 - Criacao de Pedido (carrinho, frete, pagamento e pedido)
-- =============================================================================

-- RN0023 - a composicao obrigatoria do endereco exige tipo de residencia e tipo
-- de logradouro, que a fase anterior nao tinha. ADD COLUMN IF NOT EXISTS
-- acrescenta as colunas sem recriar a tabela nem perder os enderecos ja
-- cadastrados.
--
-- As colunas ficam opcionais NO BANCO porque os enderecos criados na fase
-- anterior nao as possuem, e inventar um valor para eles seria falsear dado.
-- Para endereco novo ou alterado elas sao obrigatorias -- quem cobra isso e o
-- validacao.js, que e onde a regra fica visivel.
ALTER TABLE tb_endereco ADD COLUMN IF NOT EXISTS tipo_residencia VARCHAR(20);
ALTER TABLE tb_endereco ADD COLUMN IF NOT EXISTS tipo_logradouro VARCHAR(20);

-- RF0035 / RF0036 - durante a compra o cliente pode cadastrar um endereco ou um
-- cartao novo e ESCOLHER se quer guarda-lo no perfil.
--
-- O pedido precisa apontar para o endereco da entrega e para o cartao usado de
-- qualquer jeito, senao nao da para saber depois onde foi entregue nem como foi
-- pago. Entao o registro sempre e criado; esta coluna diz se ele tambem faz
-- parte do perfil do cliente.
--
-- salvo_no_perfil = FALSE significa "existe so para aquele pedido": o registro
-- nao aparece na lista de enderecos nem na de cartoes do cliente.
-- DEFAULT TRUE para que tudo que foi cadastrado na fase anterior continue no
-- perfil, como sempre esteve.
ALTER TABLE tb_endereco       ADD COLUMN IF NOT EXISTS salvo_no_perfil BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tb_cartao_credito ADD COLUMN IF NOT EXISTS salvo_no_perfil BOOLEAN NOT NULL DEFAULT TRUE;

-- Produtos da loja.
--
-- O cadastro de produto (RF0011 a RF0016) e a entrada em estoque (RF0051) sao
-- de outra fase do DRS e nao foram implementados: os produtos entram pelo
-- seed.sql, que e exatamente o que o enunciado pede ("devem existir previamente
-- na base"). Por isso o estoque e uma coluna simples aqui, e nao uma tabela de
-- movimentacao com custo, fornecedor e data de entrada.
CREATE TABLE IF NOT EXISTS tb_produto (
    id                 BIGSERIAL     PRIMARY KEY,
    -- UNIQUE no nome: a loja nao deve ter dois produtos iguais, e e o que
    -- permite ao seed.sql usar ON CONFLICT DO NOTHING e rodar quantas vezes
    -- quiser sem duplicar o catalogo.
    nome               VARCHAR(120)  NOT NULL UNIQUE,
    categoria          VARCHAR(60)   NOT NULL,
    descricao          VARCHAR(255)  NOT NULL,
    preco              NUMERIC(10,2) NOT NULL CHECK (preco > 0),
    -- RN0031 valida a adicao ao carrinho contra esta coluna.
    quantidade_estoque INTEGER       NOT NULL DEFAULT 0 CHECK (quantidade_estoque >= 0),
    icone              VARCHAR(40)   NOT NULL DEFAULT 'fa-box',
    ativo              BOOLEAN       NOT NULL DEFAULT TRUE
);

-- Caminho da ilustracao do produto (SVG em public/imagens/produtos/).
--
-- Fica numa coluna, e nao deduzido do id do produto, para que trocar a imagem
-- de um produto seja um UPDATE e nao exija renomear arquivo. O 'icone' continua
-- existindo como reserva: se a imagem nao carregar, a tela cai nele.
ALTER TABLE tb_produto ADD COLUMN IF NOT EXISTS imagem VARCHAR(120);

-- RF0031 - carrinho de compra.
--
-- Nao existe tabela "tb_carrinho": o carrinho de um cliente E o conjunto de
-- linhas desta tabela com o cliente_id dele. Uma tabela so em vez de duas,
-- porque um carrinho sem itens nao precisa existir no banco.
--
-- O UNIQUE (cliente_id, produto_id) garante que o mesmo produto nao apareca
-- duas vezes no carrinho: adicionar de novo soma a quantidade na linha que ja
-- existe, em vez de criar uma segunda.
CREATE TABLE IF NOT EXISTS tb_carrinho_item (
    id         BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT    NOT NULL REFERENCES tb_cliente (id),
    produto_id BIGINT    NOT NULL REFERENCES tb_produto (id),
    quantidade INTEGER   NOT NULL CHECK (quantidade > 0),
    UNIQUE (cliente_id, produto_id)
);

-- RF0037 - cupons usados como forma de pagamento.
--
-- Dois tipos, com regras diferentes:
--   PROMOCIONAL - campanha da loja, vale para qualquer cliente (cliente_id NULL).
--                 RN0033 permite apenas um por compra.
--   TROCA       - pertence a um cliente especifico (cliente_id preenchido).
--                 Nasce de uma devolucao (RF0045, outra fase) ou do troco de
--                 cupons que superam a compra (RN0036, implementado aqui).
--
-- 'usado' impede que o mesmo cupom pague duas compras. Um cupom nunca e
-- apagado: vira usado = TRUE e continua no banco, igual ao soft delete do cliente.
CREATE TABLE IF NOT EXISTS tb_cupom (
    id         BIGSERIAL     PRIMARY KEY,
    codigo     VARCHAR(40)   NOT NULL UNIQUE,
    tipo       VARCHAR(20)   NOT NULL CHECK (tipo IN ('PROMOCIONAL', 'TROCA')),
    valor      NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    cliente_id BIGINT        REFERENCES tb_cliente (id),
    usado      BOOLEAN       NOT NULL DEFAULT FALSE
);

-- Guarda de qual compra nasceu um cupom de troca da RN0036 (o troco de cupons
-- que superaram o valor do pedido). Fica NULL nos cupons promocionais, que nao
-- vem de compra nenhuma.
--
-- Esta em um ALTER separado, e nao dentro do CREATE TABLE acima, porque a
-- coluna aponta para tb_pedido -- que so e criada mais abaixo. E a forma mais
-- simples de resolver duas tabelas que se referenciam em ordens opostas.
ALTER TABLE tb_cupom ADD COLUMN IF NOT EXISTS pedido_origem_id BIGINT;

-- RF0038 - o pedido finalizado.
--
-- Os status abaixo sao todos os que o DRS preve. Esta fase gera apenas
-- EM PROCESSAMENTO; os outros vem das fases de aprovacao, entrega e troca. Estao
-- no CHECK como documentacao do ciclo de vida completo da compra.
CREATE TABLE IF NOT EXISTS tb_pedido (
    id          BIGSERIAL     PRIMARY KEY,
    cliente_id  BIGINT        NOT NULL REFERENCES tb_cliente (id),
    endereco_id BIGINT        NOT NULL REFERENCES tb_endereco (id),
    status      VARCHAR(30)   NOT NULL CHECK (status IN (
                    'EM PROCESSAMENTO', 'APROVADA', 'REPROVADA', 'EM TRANSPORTE',
                    'ENTREGUE', 'EM TROCA', 'TROCA AUTORIZADA', 'TROCADO')),
    subtotal    NUMERIC(10,2) NOT NULL,
    frete       NUMERIC(10,2) NOT NULL,
    total       NUMERIC(10,2) NOT NULL,
    data_pedido TIMESTAMP     NOT NULL
);

-- Itens do pedido.
--
-- nome_produto e preco_unitario sao copiados do produto no momento da compra,
-- em vez de lidos por JOIN na hora de exibir. E de proposito: se o preco do
-- produto mudar amanha, o pedido de hoje tem que continuar mostrando o valor
-- que o cliente realmente pagou.
CREATE TABLE IF NOT EXISTS tb_pedido_item (
    id             BIGSERIAL     PRIMARY KEY,
    pedido_id      BIGINT        NOT NULL REFERENCES tb_pedido (id),
    produto_id     BIGINT        NOT NULL REFERENCES tb_produto (id),
    nome_produto   VARCHAR(120)  NOT NULL,
    preco_unitario NUMERIC(10,2) NOT NULL,
    quantidade     INTEGER       NOT NULL CHECK (quantidade > 0)
);

-- RF0036 / RF0037 - como o pedido foi pago.
--
-- Uma linha por forma de pagamento, porque RN0034 permite varios cartoes e
-- RN0033/RN0037 permitem somar cupons. A soma dos valores desta tabela para um
-- pedido e sempre igual ao total do pedido.
CREATE TABLE IF NOT EXISTS tb_pedido_pagamento (
    id        BIGSERIAL     PRIMARY KEY,
    pedido_id BIGINT        NOT NULL REFERENCES tb_pedido (id),
    tipo      VARCHAR(20)   NOT NULL CHECK (tipo IN ('CARTAO', 'CUPOM')),
    cartao_id BIGINT        REFERENCES tb_cartao_credito (id),
    cupom_id  BIGINT        REFERENCES tb_cupom (id),
    valor     NUMERIC(10,2) NOT NULL CHECK (valor > 0)
);

CREATE INDEX IF NOT EXISTS idx_carrinho_cliente  ON tb_carrinho_item (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedido_cliente    ON tb_pedido (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedido_item       ON tb_pedido_item (pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_pagamento  ON tb_pedido_pagamento (pedido_id);
CREATE INDEX IF NOT EXISTS idx_cupom_cliente     ON tb_cupom (cliente_id);
