# CLAUDE.md

Este arquivo fornece orientações ao Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Idioma

Todas as respostas ao usuário devem ser em português (PT-BR), independentemente do idioma da instrução recebida. Este arquivo (CLAUDE.md) também deve sempre permanecer em português — ao editá-lo, mantenha o conteúdo traduzido.

## Visão geral do projeto

Nexus Gaming Gear — um protótipo de e-commerce de periféricos gamer. Backend REST em **Node.js + Express 5** servindo um front-end estático em HTML/Tailwind/JS puro, com PostgreSQL acessado por **SQL escrito à mão** (biblioteca `pg`, sem ORM) e testes E2E em Cypress cobrindo o fluxo de CRUD de clientes. É um projeto acadêmico/de avaliação (os entregáveis DVP — Documento de Visão do Produto — e DRS ficam em `docs/`).

**Restrição central do projeto:** o código é apresentado e defendido linha por linha para uma banca de professores. Simplicidade e legibilidade vêm antes de elegância, generalidade ou economia de digitação. Ao alterar este projeto:

- Nada de camadas de abstração, factories, interfaces, injeção de dependência ou ORM.
- Estrutura de arquivos plana: uma rota é uma função que valida, consulta o banco e responde. O caminho inteiro de uma operação deve caber na tela.
- Comentários explicam o **porquê** da lógica, não o **o quê**. Comentário que só reescreve o código em português é ruído — remova.
- Preferir SQL explícito a qualquer coisa que gere SQL automaticamente.

## Comandos

### Backend (Node.js / Express)
- Instalar dependências: `npm install`
- Rodar a aplicação: `npm start` (equivale a `node backend/server.js`) — serve a API e também o front-end estático em `http://localhost:8080` (`public/index.html`).
- Requer uma instância local do PostgreSQL compatível com `backend/db.js` (banco `nexus_gaming_db`, usuário/senha `postgres`/`postgres` em `localhost:5432`). O `backend/server.js` roda `backend/schema.sql` e `backend/seed.sql` na subida, e os dois são idempotentes (`CREATE TABLE IF NOT EXISTS` / `ON CONFLICT DO NOTHING`) — subir o servidor várias vezes não recria nem apaga dados. Não há etapa separada de migração.

### Front-end / E2E (Cypress)
- Rodar em modo headless: `npm test` (equivale a `cypress run`)
- Abrir o runner do Cypress: `npm run cypress` (equivale a `cypress open`)
- Os testes Cypress assumem que a aplicação já está rodando em `http://localhost:8080` (`cy.visit('http://localhost:8080')` no `beforeEach`) — suba o backend com `npm start` antes, em outro terminal.
- Não há bundler nem dev server para o front-end; ele é servido como arquivo estático pelo próprio Express.

## Arquitetura

O backend são **7 arquivos planos** em `backend/`, sem subpastas. Não existe camada de controller/service/repository, nem DTOs, nem classes de entidade:

- **`server.js`** — ponto de entrada e o arquivo para ler primeiro. Faz quatro coisas em ordem: configura leitura de JSON e CORS, serve `public/` como estático, registra os dois grupos de rotas, e trata os erros num único lugar. Comece por aqui ao se orientar no projeto.
- **`db.js`** — pool de conexões PostgreSQL, o atalho `consultar(sql, parametros)` (devolve direto as linhas) e `prepararBanco()` (roda schema + seed na subida). Também registra um type parser que converte `BIGINT` para número, para que a API devolva `{"id": 42}` e não `{"id": "42"}` — o driver `pg` devolve bigint como texto por padrão.
- **`schema.sql`** / **`seed.sql`** — DDL explícito das 5 tabelas (`tb_cliente`, `tb_endereco`, `tb_cartao_credito`, `tb_bandeira`, `tb_auditoria`) e carga das bandeiras de cartão (RNF0013). O schema inclui os `CHECK` dos valores de enum.
- **`validacao.js`** — substitui as anotações Bean Validation por `if`s legíveis. As funções `errosDe...` acumulam mensagens numa lista (o usuário recebe todos os problemas de uma vez); as `validar...` lançam `erroDeRegra` com as mensagens juntas. Exporta `erroDeRegra(mensagem)`, que marca o erro com `regraDeNegocio = true`.
- **`rotas-clientes.js`** — os 11 endpoints de `/api/clientes`, mais as funções de conversão de linha do banco para JSON da API (`respostaDeEndereco`, `respostaDeCartao`, `montarClientes`).
- **`rotas-bandeiras.js`** — `GET /api/bandeiras`, somente leitura.
- **`auditoria.js`** — `registrar(entidade, entidadeId, operacao, usuarioResponsavel, detalhes)`.

### Pontos a preservar ao alterar o projeto

- **Superfície da API**: `/api/clientes` — POST para cadastrar, GET para listar (sem parâmetros retorna só os ativos; com `nome`/`cpf`/`email`/`telefone`/`ativo` filtra), GET por id, PUT para alterar, PATCH `/{id}/inativar` para soft delete, PATCH `/{id}/senha` para alterar senha. Também aninha endereço (`POST`/`GET /{id}/enderecos`, `PUT /{id}/enderecos/{enderecoId}`) e cartão (`POST`/`GET /{id}/cartoes`). `GET /api/bandeiras` lista as bandeiras cadastradas. O CORS está totalmente aberto porque o front-end chama a API via URLs absolutas (`http://localhost:8080/api/...`) a partir do JS estático.

- **Tratamento de erros centralizado**: o middleware de erro no fim de `server.js` é o equivalente do antigo `GlobalExceptionHandler`. Como o Express 5 encaminha automaticamente rejeições de funções `async`, as rotas **não têm `try/catch`** — elas simplesmente lançam. Para uma nova regra de negócio, lance `erroDeRegra('mensagem para o usuário')` e o middleware responde `400` com `{"message": "..."}`. Qualquer outro erro vira `500` com mensagem genérica e stack trace no console (para não vazar detalhes do banco). Há também um caso especial para o código `23505` do Postgres (violação de UNIQUE).

- **Padrão de soft delete**: `tb_cliente.ativo` é um booleano; `PATCH /{id}/inativar` faz `UPDATE ... SET ativo = FALSE`, e a listagem sem filtro usa `WHERE ativo = TRUE`. **Não existe nenhum `DELETE` em lugar nenhum da aplicação**, e isso é intencional — preserve esse padrão ao adicionar outras entidades.

- **Auditoria**: chame `auditoria.registrar(...)` em toda operação de escrita, **depois** que ela deu certo (RNF0012). Assim uma tentativa que falhou não gera linha na trilha.

- **Transação no cadastro**: `POST /api/clientes` pega uma conexão específica do pool e usa `BEGIN`/`COMMIT`/`ROLLBACK` com `try/catch/finally`, porque cliente + endereço + cartão precisam entrar juntos ou não entrar (um cliente sem endereço violaria o RN0026). O `conexao.release()` no `finally` é obrigatório — sem ele o pool esgota. Esse é o único lugar da aplicação que precisa de transação; as outras rotas fazem uma escrita só.

- **Segurança de senha**: `bcryptjs` com custo 10 (`CUSTO_BCRYPT` em `rotas-clientes.js`) — mesmo custo que o Spring Security usava, então os hashes já gravados continuam válidos. A senha (mesmo o hash) **nunca** entra numa resposta da API. Não há fluxo de login/autenticação ainda; a aplicação identifica o cliente por um `clienteId` no `localStorage`.

- **Datas**: `data_nascimento` sai do banco via `TO_CHAR(data_nascimento, 'YYYY-MM-DD')`, como texto. Isso não é detalhe de estilo: o front-end joga o valor direto num `<input type="date">`, que só aceita esse formato. Se o driver devolvesse um objeto `Date`, o JSON viraria `"1998-03-15T00:00:00.000Z"` e o campo apareceria vazio na tela. A validação em `validacao.js` também compara datas como texto `AAAA-MM-DD`, o que evita bugs de fuso horário.

- **Conversão de nomes**: o banco usa `snake_case` e a API usa `camelCase`. A tradução é feita campo por campo, à mão, nas funções `respostaDe...` — é o que deixa visível o que a API expõe e o que ela não expõe (número completo do cartão, CVV e senha ficam de fora).

- **Evitar N+1**: `montarClientes()` faz 3 consultas no total (clientes, todos os endereços da lista, todos os cartões da lista) e agrupa em memória com `filter`, em vez de uma consulta por cliente. Use `WHERE cliente_id = ANY($1)` ao adicionar coleções novas.

- **Front-end** (`public/index.html`) é um único arquivo HTML estático — Tailwind via CDN, Chart.js via CDN, Font Awesome via CDN, e funções `<script>` inline puras (`switchView`, `cadastrarCliente`, `atualizarCliente`, `inativarContaCliente`) que fazem a troca de views e chamadas `fetch()` diretamente ao backend. Não há bundler, framework ou sistema de módulos — novo trabalho de UI deve seguir essa mesma convenção de JS puro em script inline, a menos que o projeto seja explicitamente reestruturado.

- **Cobertura E2E** (`cypress/e2e/crud-cliente.cy.js`) exercita a UI de ponta a ponta contra a aplicação em execução (cadastro → edição → senha → endereço → cartão → soft delete → consulta por filtro), verificando o texto de `window:alert` e, para a inativação, uma checagem posterior via `GET /api/clientes?ativo=false`. Os seletores são ids simples (`#cad-nome`, `#edit-nome`, `#btn-inativar`, etc.) — mantenha esses ids estáveis em `public/index.html` ao refatorar o front-end, ou atualize o spec junto.

## Histórico

O backend foi originalmente escrito em Spring Boot 4.1.1 / Java 21, com JPA/Hibernate, Lombok, Bean Validation e as camadas `controller` → `service` → `repository` → `domain.model` + `dto`. Foi reescrito em Node.js/Express mantendo a API, o banco e o front-end idênticos, com o objetivo explícito de tornar o código defensável linha por linha numa apresentação acadêmica. O código Java está no histórico do git (até o commit anterior à reescrita) caso seja preciso consultar.
