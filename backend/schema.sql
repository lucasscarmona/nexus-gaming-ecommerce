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
