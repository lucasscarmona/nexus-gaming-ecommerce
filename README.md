# Nexus Gaming Gear

Protótipo de e-commerce de periféricos gamer. Módulo implementado: **Gestão de Clientes** (CRUD completo, conforme o DRS em `docs/`).

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express 5 |
| Banco | PostgreSQL, acessado com SQL escrito à mão (biblioteca `pg`, **sem ORM**) |
| Front-end | HTML + Tailwind (CDN) + JavaScript puro, arquivo único |
| Senhas | BCrypt (`bcryptjs`) |
| Testes E2E | Cypress |

---

## Como rodar

**1. Pré-requisitos:** Node.js 18+ e PostgreSQL rodando em `localhost:5432` com um banco chamado `nexus_gaming_db` (usuário `postgres`, senha `postgres`).

```sql
CREATE DATABASE nexus_gaming_db;
```

As tabelas **não** precisam ser criadas à mão: o servidor roda `backend/schema.sql` e `backend/seed.sql` sozinho ao subir.

**2. Instalar e rodar:**

```bash
npm install
npm start
```

Abra **http://localhost:8080** — o mesmo servidor entrega as telas e a API.

**3. Rodar os testes E2E** (com o servidor no ar, em outro terminal):

```bash
npm test          # modo headless
npm run cypress   # abre a interface do Cypress
```

---

## Estrutura

```
backend/              7 arquivos, sem subpastas
  server.js           <- COMECE AQUI. Sobe o servidor, serve as telas,
                         registra as rotas e trata os erros.
  db.js               Conexão com o PostgreSQL e o atalho consultar()
  schema.sql          As 5 tabelas, em SQL explícito
  seed.sql            Carga das bandeiras de cartão (RNF0013)
  validacao.js        Validação dos dados que chegam (ifs, não anotações)
  rotas-clientes.js   Os 11 endpoints de /api/clientes
  rotas-bandeiras.js  GET /api/bandeiras (só leitura)
  auditoria.js        Grava a trilha de auditoria (RNF0012)

public/
  index.html          Todas as telas, em um arquivo

cypress/e2e/
  crud-cliente.cy.js  11 testes de ponta a ponta

docs/                 DVP, DRS, estimativa e apresentação
```

Não há camada de controller/service/repository, nem DTOs, nem classes de entidade. **Cada endpoint é uma função que valida, consulta o banco e responde** — o caminho inteiro de uma operação cabe na tela.

---

## Endpoints

| Método | Rota | O que faz | Requisito |
|---|---|---|---|
| `POST` | `/api/clientes` | Cadastra cliente (+ endereço, + cartão opcional) | RF0021 |
| `GET` | `/api/clientes` | Lista os ativos; com `?nome=`/`?cpf=`/`?email=`/`?telefone=`/`?ativo=`, filtra | RF0024 |
| `GET` | `/api/clientes/:id` | Busca um cliente | — |
| `PUT` | `/api/clientes/:id` | Altera dados cadastrais | RF0022 |
| `PATCH` | `/api/clientes/:id/inativar` | Inativação lógica (soft delete) | RF0023 |
| `PATCH` | `/api/clientes/:id/senha` | Altera **apenas** a senha | RF0028 |
| `POST` | `/api/clientes/:id/enderecos` | Adiciona endereço | RF0026 |
| `GET` | `/api/clientes/:id/enderecos` | Lista endereços | — |
| `PUT` | `/api/clientes/:id/enderecos/:enderecoId` | Altera um endereço isoladamente | RNF0034 |
| `POST` | `/api/clientes/:id/cartoes` | Adiciona cartão de crédito | RF0027 |
| `GET` | `/api/clientes/:id/cartoes` | Lista cartões (sempre mascarados) | — |
| `GET` | `/api/bandeiras` | Lista as bandeiras aceitas | RN0025 |

Erros de regra de negócio respondem `400` com `{"message": "mensagem para o usuário"}`.

---

## Onde cada requisito está no código

| Requisito | Onde | Como |
|---|---|---|
| **RF0021** Cadastrar cliente | `rotas-clientes.js`, `POST /` | Valida, checa CPF e e-mail duplicados, criptografa a senha e grava cliente + endereço + cartão em uma transação |
| **RF0022** Alterar cliente | `rotas-clientes.js`, `PUT /:id` | `UPDATE` só dos dados cadastrais; CPF e senha ficam de fora |
| **RF0023** Inativar cliente | `rotas-clientes.js`, `PATCH /:id/inativar` | `UPDATE ... SET ativo = FALSE`. **Não existe `DELETE` em lugar nenhum da aplicação** — apagar o cliente levaria embora o histórico de pedidos dele |
| **RF0024** Consultar por filtro | `rotas-clientes.js`, `GET /` | Um único SQL atende qualquer combinação: cada condição do `WHERE` se neutraliza quando o parâmetro não vem |
| **RF0026** Vários endereços | `rotas-clientes.js`, `POST /:id/enderecos` | Tabela `tb_endereco` separada, com `cliente_id` |
| **RF0027** Cartões de crédito | `rotas-clientes.js`, `POST /:id/cartoes` | Primeiro cartão é sempre o preferencial; ao marcar um novo, os outros perdem a marca |
| **RF0028** Alterar só a senha | `rotas-clientes.js`, `PATCH /:id/senha` | Endpoint próprio, não exige reenviar os demais dados |
| **RN0021/RN0022** Endereço de cobrança e de entrega | `schema.sql`, `tipo_endereco` | `COBRANCA`, `ENTREGA` ou `AMBOS`; o cadastro assume `AMBOS` quando o cliente usa o mesmo endereço |
| **RN0025** Bandeira válida | `rotas-clientes.js`, `exigirBandeira()` | A bandeira tem que existir em `tb_bandeira`; o `<select>` da tela é montado a partir dessa mesma tabela |
| **RN0026** Campos obrigatórios | `validacao.js` | `errosDeDadosPessoais`, `errosDeEndereco`, `errosDeCartao` |
| **RNF0012** Log de auditoria | `auditoria.js` + `tb_auditoria` | Toda escrita grava quem fez, o quê e quando — sempre **depois** de a operação dar certo |
| **RNF0013** Script de implantação | `seed.sql` | Popula as bandeiras; idempotente (`ON CONFLICT DO NOTHING`) |
| **RNF0031** Senha forte | `validacao.js`, `REGRA_DE_SENHA` | Mínimo 8 caracteres, com maiúscula, minúscula e caractere especial |
| **RNF0032** Confirmação de senha | `rotas-clientes.js`, `POST /` e `PATCH /:id/senha` | Compara senha e confirmação |
| **RNF0033** Senha criptografada | `rotas-clientes.js`, `bcrypt.hash` | Hash BCrypt irreversível; a senha nunca entra numa resposta da API |
| **RNF0034** Edição isolada | `PATCH /:id/senha`, `PUT /:id/enderecos/:enderecoId` | Endpoints próprios para alterar uma coisa sem reenviar as outras |

---

## Decisões de projeto (as perguntas que a banca costuma fazer)

**Por que SQL à mão e não um ORM?**
Para que toda consulta que a aplicação faz esteja escrita no código, visível. O ORM anterior (Hibernate) gerava as consultas a partir de anotações nas classes, e não havia como saber o que ia para o banco sem ligar o log — inclusive o problema N+1 descrito abaixo, que era invisível.

**E o risco de SQL injection?**
Os valores nunca são concatenados no texto do SQL. Entram como parâmetros (`$1`, `$2`...), que viajam separados e são combinados pelo banco. Um nome de cliente como `'; DROP TABLE tb_cliente; --` chega ao banco como texto a ser procurado, nunca como comando.

**Por que a lista de clientes faz 3 consultas e não 1 por cliente?**
Em `montarClientes()`: uma lista de 40 clientes com uma consulta de endereços e uma de cartões por cliente daria 81 idas ao banco. São 3, sempre — clientes, todos os endereços da lista, todos os cartões — e o agrupamento acontece em memória.

**Por que o cadastro usa transação e as outras rotas não?**
O cadastro grava em três tabelas. Sem `BEGIN`/`COMMIT`, uma falha ao gravar o endereço deixaria no banco um cliente sem endereço nenhum — um cadastro pela metade que o RN0026 não admite e que ninguém corrigiria pela tela. As outras rotas fazem uma escrita só, então não há nada para desfazer parcialmente.

**Por que as rotas não têm `try/catch`?**
O Express 5 encaminha automaticamente os erros de funções `async` para o tratamento central no fim do `server.js`. As rotas lançam `erroDeRegra('...')` e o middleware responde `400` com a mensagem. Centralizar o tratamento também garante que erro inesperado não vaze detalhe interno do banco para a tela.

**Por que a data de nascimento vem do banco como texto?**
`TO_CHAR(data_nascimento, 'YYYY-MM-DD')`. A tela joga o valor direto num `<input type="date">`, que só aceita esse formato. Se o driver devolvesse uma data, o JSON viraria `"1998-03-15T00:00:00.000Z"` e o campo apareceria vazio. Converter no SQL tira o fuso horário da conta.

**Por que não há tela de login?**
Não está no escopo deste módulo do DRS. A aplicação guarda o `clienteId` no `localStorage` para saber de quem são os dados exibidos. A infraestrutura de senha (hash BCrypt, regra de senha forte, troca de senha) já está pronta para quando o login entrar.
