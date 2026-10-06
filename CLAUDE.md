# CLAUDE.md

Este arquivo fornece orientações ao Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Idioma

Todas as respostas ao usuário devem ser em português (PT-BR), independentemente do idioma da instrução recebida. Este arquivo (CLAUDE.md) também deve sempre permanecer em português — ao editá-lo, mantenha o conteúdo traduzido.

## Visão geral do projeto

Nexus Gaming Gear — um protótipo de e-commerce de periféricos gamer. Backend REST em **Node.js + Express 5** servindo um front-end estático em HTML/Tailwind/JS puro, com PostgreSQL acessado por **SQL escrito à mão** (biblioteca `pg`, sem ORM) e testes E2E em Cypress. É um projeto acadêmico/de avaliação (os entregáveis DVP — Documento de Visão do Produto — e DRS ficam em `docs/`).

**O DRS (`docs/DRS_LES_2_2026.pdf`) é a única referência de requisitos.** Ele descreve um e-commerce de livros; o domínio do produto (periféricos gamer) vem do DVP. Comportamentos, campos ou regras que não estejam no DRS não são considerados na avaliação — não invente requisitos.

Fases implementadas:
1. **Cadastro de Clientes** (RF0021–RF0028) — CRUD completo com soft delete.
2. **Criação de Pedido** (RF0031–RF0038) — carrinho, frete, pagamento com cartões e cupons, finalização.

Fora do escopo até agora: cadastro/consulta de livros (RF0011–RF0016), entrada em estoque (RF0051) e baixa de estoque (RF0053/RN0028), validação da operadora e mudanças de status após a finalização (RN0037–RN0040, RF0039, RF0040), bloqueio e expiração de itens no carrinho (RN0032, RN0044, RN0045, RNF0042), e todo o processo de troca (RF0041–RF0045, RN0041–RN0046). Os produtos e o estoque entram por `backend/seed.sql`.

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

O backend são **13 arquivos planos** em `backend/` (11 `.js` + 2 `.sql`), sem subpastas. Não existe camada de controller/service/repository, nem DTOs, nem classes de entidade:

- **`server.js`** — ponto de entrada e o arquivo para ler primeiro. Faz quatro coisas em ordem: configura leitura de JSON e CORS, serve `public/` como estático, registra os grupos de rotas, e trata os erros num único lugar. Comece por aqui ao se orientar no projeto.
- **`db.js`** — pool de conexões PostgreSQL, o atalho `consultar(sql, parametros)` (devolve direto as linhas) e `prepararBanco()` (roda schema + seed na subida). Também registra dois type parsers: `BIGINT` e `NUMERIC` viram número, para a API devolver `{"id": 42}` e `{"preco": 899}` em vez de texto — o driver `pg` devolve os dois como string por padrão.
- **`schema.sql`** / **`seed.sql`** — DDL explícito das 11 tabelas e carga das bandeiras (RNF0013), dos produtos com estoque e dos cupons promocionais de demonstração. O schema inclui os `CHECK` dos valores de enum. Mudanças em tabelas que já existiam entram como `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, para não perder os dados das fases anteriores.
- **`validacao.js`** — substitui as anotações Bean Validation por `if`s legíveis. As funções `errosDe...` acumulam mensagens numa lista (o usuário recebe todos os problemas de uma vez); as `validar...` lançam `erroDeRegra` com as mensagens juntas. Exporta `erroDeRegra(mensagem)`, que marca o erro com `regraDeNegocio = true`. **Só valida formato** — as regras de pagamento ficam em `rotas-pedidos.js`.
- **`dinheiro.js`** — `emCentavos`, `emReais` e `formatar`. Toda soma e comparação de dinheiro passa por centavos (inteiros), porque as regras de pagamento comparam valores por igualdade exata e ponto flutuante erraria por centavos.
- **`frete.js`** — RF0034, isolado num arquivo só para ser fácil de mostrar. Critério adotado (o DRS não define): `taxa da região do estado + R$ 4,00 × quantidade de itens`.
- **`auditoria.js`** — `registrar(entidade, entidadeId, operacao, usuarioResponsavel, detalhes)`.
- **`rotas-clientes.js`** — os 11 endpoints de `/api/clientes`, mais as funções de conversão de linha do banco para JSON da API (`respostaDeEndereco`, `respostaDeCartao`, `montarClientes`).
- **`rotas-bandeiras.js`** / **`rotas-produtos.js`** — `GET /api/bandeiras` e `GET /api/produtos`, somente leitura (tabelas de domínio e catálogo, populados pelo seed).
- **`rotas-carrinho.js`** — RF0031/RF0032. Exporta `{ rotas, buscarItensDoCarrinho }`; a segunda é reaproveitada por `rotas-pedidos.js`, para que a tela do carrinho e a finalização enxerguem exatamente os mesmos itens.
- **`rotas-pedidos.js`** — RF0033 a RF0038. É onde moram as quatro regras de pagamento, cada uma em sua função: `validarRegrasDeCupons` (RN0033 e RN0036) e `validarRegrasDeCartoes` (RN0034 e RN0035).

### Pontos a preservar ao alterar o projeto

- **Superfície da API**: `/api/clientes` — POST para cadastrar, GET para listar (sem parâmetros retorna só os ativos; com `nome`/`cpf`/`email`/`telefone`/`ativo` filtra), GET por id, PUT para alterar, PATCH `/{id}/inativar` para soft delete, PATCH `/{id}/senha` para alterar senha. Também aninha endereço (`POST`/`GET /{id}/enderecos`, `PUT /{id}/enderecos/{enderecoId}`) e cartão (`POST`/`GET /{id}/cartoes`). `GET /api/bandeiras` e `GET /api/produtos` listam as tabelas de domínio. `/api/carrinho/{clienteId}` tem GET, POST e `PUT`/`DELETE` em `/itens/{itemId}`. `/api/pedidos/{clienteId}` tem `GET /frete?estado=XX`, `GET /cupons`, `POST` (finalizar) e `GET` (consultar). O CORS está totalmente aberto porque o front-end chama a API via URLs absolutas (`http://localhost:8080/api/...`) a partir do JS estático.

- **Regras de pagamento (RN0033 a RN0036)**: estão em `rotas-pedidos.js` e são o coração desta fase. RN0033 — no máximo um cupom **promocional** por compra (cupons de troca não têm limite, são dinheiro do próprio cliente). RN0036 — nenhum cupom pode ser desnecessário: se dá para remover um cupom e os restantes ainda cobrem o total, a compra é recusada; o que os cupons passarem do total vira um cupom de troca para o cliente. RN0034 — cada cartão precisa de R$ 10,00 no mínimo. RN0035 — a exceção: quando há cupons e o que sobra já é menor que R$ 10,00, aquele valor pode ir num **único** cartão. A soma dos pagamentos tem de bater exatamente com o total.

- **Todo cupom é de uso único**, promocional inclusive (`usado = TRUE` após a compra). Sem isso haveria uma brecha: um cupom promocional reutilizável de R$ 100,00 numa compra de R$ 50,00 geraria, pela RN0036, um cupom de troca de R$ 50,00 a cada uso.

- **`salvo_no_perfil`** em `tb_endereco` e `tb_cartao_credito`: RF0035/RF0036 permitem cadastrar endereço e cartão **durante a compra** e escolher se eles entram no perfil. O pedido precisa referenciá-los de qualquer forma, então o registro sempre é criado e esta coluna diz se ele também aparece nas listas do cliente. Toda consulta de perfil filtra por `salvo_no_perfil = TRUE`.

- **Dinheiro**: nunca some nem compare valores em reais diretamente. Use `emCentavos()` de `dinheiro.js`, faça a conta com inteiros, e converta de volta com `emReais()` só para gravar e exibir. O front-end tem a sua própria `emCentavos()`, pelo mesmo motivo.

- **Divisão automática entre cartões** (`distribuirValorEntreCartoes()` no front-end): escolher um cartão lhe atribui o valor inteiro a pagar; adicionar outros divide igualmente, com a sobra de centavos indo para os primeiros. Roda quando o **conjunto** de cartões muda (escolher, adicionar, remover) ou quando o valor a pagar muda (cupom, frete, carrinho) — **nunca** depois de `alterarValorDaLinha`, que é o cliente digitando à mão. Ao escrever teste que precisa de valores específicos, selecione todos os cartões primeiro e só então digite os valores, senão a redistribuição sobrescreve o que foi digitado.

- **Ilustrações dos produtos**: SVGs em `public/imagens/produtos/`, apontados pela coluna `tb_produto.imagem` e preenchidos por `UPDATE` no `seed.sql` (não pelo `INSERT`, que é ignorado para produtos já existentes por causa do `ON CONFLICT DO NOTHING`). A tela monta o `src` com `BASE_DO_SERVIDOR`, derivado de `API_BASE`, para a imagem ser buscada no back-end mesmo quando a página é aberta por outra origem. O `icone` do Font Awesome continua existindo como reserva no `onerror` da `<img>`.

- **Origem da página**: `API_BASE` é `/api` quando a página vem do próprio back-end (porta 8080) e `http://localhost:8080/api` quando vem de outro lugar (preview do IntelliJ, Live Server). Se precisar servir em outra porta, ajuste essa linha.

- **Tratamento de erros centralizado**: o middleware de erro no fim de `server.js` é o equivalente do antigo `GlobalExceptionHandler`. Como o Express 5 encaminha automaticamente rejeições de funções `async`, as rotas **não têm `try/catch`** — elas simplesmente lançam. Para uma nova regra de negócio, lance `erroDeRegra('mensagem para o usuário')` e o middleware responde `400` com `{"message": "..."}`. Qualquer outro erro vira `500` com mensagem genérica e stack trace no console (para não vazar detalhes do banco). Há também um caso especial para o código `23505` do Postgres (violação de UNIQUE).

- **Padrão de soft delete**: `tb_cliente.ativo` é um booleano; `PATCH /{id}/inativar` faz `UPDATE ... SET ativo = FALSE`, e a listagem sem filtro usa `WHERE ativo = TRUE`. **O único `DELETE` físico da aplicação está no carrinho**, e é intencional: o RF0031 chama o carrinho de "repositório temporário", então um item removido nunca foi uma compra e não há histórico a preservar. Em todo o resto, preserve o soft delete.

- **RN0023 (composição do endereço)**: o endereço exige `tipoResidencia` e `tipoLogradouro` além dos campos usuais. No banco as colunas aceitam `NULL` porque os endereços da fase 1 não as têm, e inventar valor para eles seria falsear dado; quem exige os campos em endereço novo ou alterado é o `validacao.js`. Ao criar cliente pela API (inclusive em testes), envie os dois.

- **Auditoria**: chame `auditoria.registrar(...)` em toda operação de escrita, **depois** que ela deu certo (RNF0012). Assim uma tentativa que falhou não gera linha na trilha.

- **Transação no cadastro**: `POST /api/clientes` pega uma conexão específica do pool e usa `BEGIN`/`COMMIT`/`ROLLBACK` com `try/catch/finally`, porque cliente + endereço + cartão precisam entrar juntos ou não entrar (um cliente sem endereço violaria o RN0026). O `conexao.release()` no `finally` é obrigatório — sem ele o pool esgota. Esse é o único lugar da aplicação que precisa de transação; as outras rotas fazem uma escrita só.

- **Segurança de senha**: `bcryptjs` com custo 10 (`CUSTO_BCRYPT` em `rotas-clientes.js`) — mesmo custo que o Spring Security usava, então os hashes já gravados continuam válidos. A senha (mesmo o hash) **nunca** entra numa resposta da API. Não há fluxo de login/autenticação ainda; a aplicação identifica o cliente por um `clienteId` no `localStorage`.

- **Datas**: `data_nascimento` sai do banco via `TO_CHAR(data_nascimento, 'YYYY-MM-DD')`, como texto. Isso não é detalhe de estilo: o front-end joga o valor direto num `<input type="date">`, que só aceita esse formato. Se o driver devolvesse um objeto `Date`, o JSON viraria `"1998-03-15T00:00:00.000Z"` e o campo apareceria vazio na tela. A validação em `validacao.js` também compara datas como texto `AAAA-MM-DD`, o que evita bugs de fuso horário.

- **Conversão de nomes**: o banco usa `snake_case` e a API usa `camelCase`. A tradução é feita campo por campo, à mão, nas funções `respostaDe...` — é o que deixa visível o que a API expõe e o que ela não expõe (número completo do cartão, CVV e senha ficam de fora).

- **Evitar N+1**: `montarClientes()` faz 3 consultas no total (clientes, todos os endereços da lista, todos os cartões da lista) e agrupa em memória com `filter`, em vez de uma consulta por cliente. Use `WHERE cliente_id = ANY($1)` ao adicionar coleções novas.

- **Front-end** (`public/index.html`) é um único arquivo HTML estático — Tailwind via CDN, Chart.js via CDN, Font Awesome via CDN, e funções `<script>` inline puras (`switchView`, `cadastrarCliente`, `atualizarCliente`, `inativarContaCliente`) que fazem a troca de views e chamadas `fetch()` diretamente ao backend. Não há bundler, framework ou sistema de módulos — novo trabalho de UI deve seguir essa mesma convenção de JS puro em script inline, a menos que o projeto seja explicitamente reestruturado.

- **Cobertura E2E**: duas suítes, 20 testes, todos pela interface.
  - `cypress/e2e/crud-cliente.cy.js` — fase 1 (cadastro → edição → senha → endereço → cartão → soft delete → consulta por filtro).
  - `cypress/e2e/criacao-pedido.cy.js` — fase 2, um teste por item do roteiro da apresentação, com o número do roteiro no título.

  Os seletores são ids simples (`#cad-nome`, `#btn-add-7`, `#valor-linha-0`, `#pedido-status`, etc.) — mantenha esses ids estáveis em `public/index.html` ao refatorar o front-end, ou atualize os specs junto.

  **Alerts nos testes**: não assevere dentro de `cy.on('window:alert', ...)` em fluxos que emitem vários alerts. O handler vale para todos os alerts seguintes do teste, e quando a asserção falha ela estoura dentro do `try/catch` da aplicação, que a mascara com "Erro de conexão." — o erro reportado fica irreconhecível. Use o padrão de `criacao-pedido.cy.js`: gravar os alerts numa lista no `beforeEach` e conferir depois com `esperarAlerta(trecho)`.

  `cypress.config.js` expõe duas tasks de preparação de cenário: `criarCupom` e `definirEstoque`. Elas escrevem direto no banco e existem porque a geração de cupom de troca (RF0045) e a entrada em estoque (RF0051) são de outras fases. Use-as apenas para montar cenário, nunca para verificar resultado — o que o teste verifica, ele verifica pela tela.

## Histórico

O backend foi originalmente escrito em Spring Boot 4.1.1 / Java 21, com JPA/Hibernate, Lombok, Bean Validation e as camadas `controller` → `service` → `repository` → `domain.model` + `dto`. Foi reescrito em Node.js/Express mantendo a API, o banco e o front-end idênticos, com o objetivo explícito de tornar o código defensável linha por linha numa apresentação acadêmica. O código Java está no histórico do git (até o commit anterior à reescrita) caso seja preciso consultar.
