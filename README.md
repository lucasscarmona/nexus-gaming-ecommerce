# Nexus Gaming Gear

Protótipo de e-commerce de periféricos gamer. Módulos implementados: **Gestão de Clientes** e **Criação de Pedido**, conforme o DRS em `docs/DRS_LES_2_2026.pdf`.

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express 5 |
| Banco | PostgreSQL, acessado com SQL escrito à mão (biblioteca `pg`, **sem ORM**) |
| Front-end | HTML + Tailwind (CDN) + JavaScript puro, arquivo único |
| Senhas | BCrypt (`bcryptjs`) |
| Testes E2E | Cypress — 20 testes, todos pela interface |

---

## Como rodar

**1. Pré-requisitos:** Node.js 18+ e PostgreSQL rodando em `localhost:5432` com um banco chamado `nexus_gaming_db` (usuário `postgres`, senha `postgres`).

```sql
CREATE DATABASE nexus_gaming_db;
```

As tabelas **não** precisam ser criadas à mão: o servidor roda `backend/schema.sql` e `backend/seed.sql` sozinho ao subir, e os dois são seguros de rodar quantas vezes quiser.

**2. Instalar e rodar:**

```bash
npm install
npm start
```

Abra **http://localhost:8080** — o mesmo servidor entrega as telas e a API.

**3. Rodar os testes E2E** (com o servidor no ar, em outro terminal):

```bash
npm test          # modo headless (20 testes)
npm run cypress   # abre a interface do Cypress
```

---

## Estrutura

```
backend/              13 arquivos, sem subpastas
  server.js           <- COMECE AQUI. Sobe o servidor, serve as telas,
                         registra as rotas e trata os erros.
  db.js               Conexão com o PostgreSQL e o atalho consultar()
  schema.sql          As 11 tabelas, em SQL explícito
  seed.sql            Bandeiras, produtos com estoque e cupons (RNF0013)
  validacao.js        Validação de formato (ifs, não anotações)
  dinheiro.js         Conta de dinheiro em centavos
  frete.js            RF0034 - o cálculo do frete, isolado
  auditoria.js        RNF0012 - trilha de auditoria
  rotas-clientes.js   RF0021 a RF0028
  rotas-bandeiras.js  Bandeiras de cartão (só leitura)
  rotas-produtos.js   Catálogo da loja (só leitura)
  rotas-carrinho.js   RF0031 / RF0032
  rotas-pedidos.js    RF0033 a RF0038 - frete, pagamento e finalização

public/
  index.html          Todas as telas, em um arquivo
  imagens/produtos/   Ilustrações SVG dos 8 produtos (32 KB no total)

cypress/e2e/
  crud-cliente.cy.js    11 testes - Cadastro de Clientes
  criacao-pedido.cy.js   9 testes - Criação de Pedido

docs/                 DRS, DVP, estimativa e apresentação
```

Não há camada de controller/service/repository, nem DTOs, nem classes de entidade. **Cada endpoint é uma função que valida, consulta o banco e responde** — o caminho inteiro de uma operação cabe na tela.

---

## Roteiro da apresentação

Os 7 itens exigidos, e o teste automatizado que demonstra cada um (`npm test`):

| # | O que demonstrar | Teste |
|---|---|---|
| 1 | Mais de um produto no carrinho e alteração da quantidade | `[ROTEIRO 1] RF0031/RF0032` |
| 2 | Compra com endereço e cartão já cadastrados | `[ROTEIRO 2 e 7] RF0033/RF0034/RF0038` |
| 3 | Compra com endereço e cartão novos, incorporados ao perfil | `[ROTEIRO 3] RF0035/RF0036/RN0023` |
| 4 | Pagamento com mais de um cartão, respeitando o mínimo | `[ROTEIRO 4] RN0034` |
| 5 | Cartão + cupons, com valor abaixo de R$ 10,00 no cartão | `[ROTEIRO 5] RN0035` |
| 6 | Cupons que superam a compra, com cupom de troca da diferença | `[ROTEIRO 6] RN0036` |
| 7 | Pedido registrado com status EM PROCESSAMENTO | verificado nos itens 2 a 6 |

Mais três testes de recusa, úteis para mostrar que as regras barram o que deve ser barrado: estoque insuficiente (RN0031), cupons desnecessários (RN0036) e dois cupons promocionais (RN0033).

**Os números da demonstração não são por acaso.** O produto *Nexus Glide Control* custa R$ 36,00; 1 unidade entregue em SP dá frete de R$ 14,00 e total de **R$ 50,00** — exatamente o valor do exemplo da RN0036 no DRS, com cupons de R$ 20,00, R$ 40,00 e R$ 35,00. A demonstração reproduz o texto do requisito literalmente.

> Os cupons do `seed.sql` (`PROMO20-A`, `PROMO40-A`, …) são de **uso único**. Se precisar repetir a demonstração manual, use o próximo código da sequência (`-B`, `-C`). Para zerar todos: `UPDATE tb_cupom SET usado = FALSE WHERE cliente_id IS NULL;`

---

## Endpoints

### Clientes (RF0021–RF0028)

| Método | Rota | O que faz | Requisito |
|---|---|---|---|
| `POST` | `/api/clientes` | Cadastra cliente (+ endereço, + cartão opcional) | RF0021 |
| `GET` | `/api/clientes` | Lista os ativos; com `?nome=`/`?cpf=`/`?email=`/`?telefone=`/`?ativo=`, filtra | RF0024 |
| `GET` | `/api/clientes/:id` | Busca um cliente | — |
| `PUT` | `/api/clientes/:id` | Altera dados cadastrais | RF0022 |
| `PATCH` | `/api/clientes/:id/inativar` | Inativação lógica (soft delete) | RF0023 |
| `PATCH` | `/api/clientes/:id/senha` | Altera **apenas** a senha | RF0028 |
| `POST`/`GET` | `/api/clientes/:id/enderecos` | Adiciona / lista endereços | RF0026 |
| `PUT` | `/api/clientes/:id/enderecos/:enderecoId` | Altera um endereço isoladamente | RNF0034 |
| `POST`/`GET` | `/api/clientes/:id/cartoes` | Adiciona / lista cartões | RF0027 |

### Loja, carrinho e pedido (RF0031–RF0038)

| Método | Rota | O que faz | Requisito |
|---|---|---|---|
| `GET` | `/api/produtos` | Catálogo com preço e estoque | — |
| `GET` | `/api/bandeiras` | Bandeiras de cartão aceitas | RN0025 |
| `GET` | `/api/carrinho/:clienteId` | Ver os itens do carrinho | RF0031 |
| `POST` | `/api/carrinho/:clienteId` | Adicionar item com quantidade | RF0031/RF0032/RN0031 |
| `PUT` | `/api/carrinho/:clienteId/itens/:itemId` | Alterar a quantidade | RF0032/RN0031 |
| `DELETE` | `/api/carrinho/:clienteId/itens/:itemId` | Excluir item | RF0031 |
| `GET` | `/api/pedidos/:clienteId/frete?estado=SP` | Prévia de subtotal, frete e total | RF0034 |
| `GET` | `/api/pedidos/:clienteId/cupons` | Cupons disponíveis do cliente | RF0037 |
| `POST` | `/api/pedidos/:clienteId` | Finalizar a compra | RF0033/RF0038 |
| `GET` | `/api/pedidos/:clienteId` | Pedidos do cliente | — |

Erros de regra de negócio respondem `400` com `{"message": "mensagem para o usuário"}`.

---

## Onde cada requisito está no código

| Requisito | Onde | Como |
|---|---|---|
| **RF0021–RF0028** Cadastro de clientes | `rotas-clientes.js` | Cadastro, alteração, soft delete, consulta por filtro, endereços, cartões e troca de senha |
| **RF0031** Gerenciar carrinho | `rotas-carrinho.js` | Adicionar, alterar, excluir e visualizar. Único `DELETE` físico da aplicação — o RF0031 chama o carrinho de "repositório temporário" |
| **RF0032** Quantidade de itens | `rotas-carrinho.js`, `POST /` e `PUT /itens/:id` | Na adição a quantidade **soma** à que já havia; na visualização ela **substitui** |
| **RN0031** Validar estoque | `rotas-carrinho.js`, `exigirEstoque()` | Produto precisa existir e ter estoque, e a quantidade **total resultante** não pode passar do disponível |
| **RF0033** Realizar compra | `rotas-pedidos.js`, `POST /:clienteId` | A compra nasce do carrinho; carrinho vazio é recusado |
| **RF0034** Calcular frete | `frete.js` | `taxa da região do estado + R$ 4,00 × quantidade de itens` |
| **RF0035 / RN0023** Endereço de entrega | `rotas-pedidos.js` + `validacao.js` | Escolher um do perfil ou cadastrar na hora, com opção de incorporar. RN0023 exige tipo de residência e tipo de logradouro |
| **RF0036 / RN0024 / RN0025** Forma de pagamento | `rotas-pedidos.js` | Cartão do perfil ou novo, com opção de incorporar. Bandeira tem de existir em `tb_bandeira` |
| **RF0037** Cupom no pagamento | `rotas-pedidos.js`, `carregarCupons()` | Cupons de troca e promocionais entram como linhas de `tb_pedido_pagamento` |
| **RN0033** Um cupom promocional | `validarRegrasDeCupons()` | No máximo um promocional. Cupons de troca não têm limite — são dinheiro do próprio cliente |
| **RN0034** Mínimo por cartão | `validarRegrasDeCartoes()` | R$ 10,00 em cada cartão, e a soma tem de bater exatamente com o valor restante |
| **RN0035** Cartão abaixo do mínimo | `validarRegrasDeCartoes()` | Quando há cupons e o restante já é menor que R$ 10,00, ele vai em um único cartão |
| **RN0036** Cupom de troca | `validarRegrasDeCupons()` + `POST /:clienteId` | Recusa cupom desnecessário; o que passar do total vira um cupom de troca do cliente |
| **RF0038** Finalizar compra | `rotas-pedidos.js` | Grava o pedido com status `EM PROCESSAMENTO` |
| **RNF0011** Tempo de resposta | `montarClientes()`, `buscarPedidos()` | 3 consultas por listagem em vez de uma por registro; índices nas chaves estrangeiras. Medido: todas as consultas abaixo de 10ms |
| **RNF0012** Log de transação | `auditoria.js` + `tb_auditoria` | Toda escrita grava quem fez, o quê e quando — sempre **depois** de a operação dar certo |
| **RNF0013** Script de implantação | `seed.sql` | Bandeiras, produtos com estoque e cupons; idempotente |
| **RNF0031–RNF0033** Senha | `validacao.js`, `rotas-clientes.js` | 8+ caracteres com maiúscula, minúscula e especial; confirmação; hash BCrypt |
| **RNF0034** Edição isolada | `PATCH /:id/senha`, `PUT /:id/enderecos/:enderecoId` | Alterar uma coisa sem reenviar as outras |

---

## Decisões de projeto (as perguntas que a banca costuma fazer)

**Por qual critério o frete é calculado?**
O DRS exige que o frete use "os itens selecionados e o endereço apontado pelo cliente", mas não define a fórmula. Adotamos `taxa da região do estado + R$ 4,00 × quantidade de itens`. A taxa por região representa a distância até o centro de distribuição, que fica em São Paulo (SP R$ 10,00, Sudeste R$ 18,00, Sul R$ 22,00, Centro-Oeste R$ 28,00, Nordeste R$ 32,00, Norte R$ 38,00); o valor por item representa o volume da encomenda. Peso não entra porque o cadastro completo de produto (RF0011) é de outra fase e não tem esse campo. Tudo está em `backend/frete.js`.

**Como o sistema impede o uso de cupons desnecessários (RN0036)?**
A regra é: se dá para remover um cupom e os restantes **ainda** cobrem o total, aquele cupom sobrava. No exemplo do DRS — compra de R$ 50,00 com cupons de R$ 20,00, R$ 40,00 e R$ 35,00 — usar os três soma R$ 95,00, e tirar o de R$ 20,00 ainda deixa R$ 75,00, acima de R$ 50,00: recusado. Com dois quaisquer a conta fecha, porque tirar qualquer um derruba o total abaixo de R$ 50,00. A diferença vira cupom de troca (R$ 5,00, R$ 10,00 ou R$ 25,00, conforme o par escolhido) — exatamente os valores que o DRS cita.

**Por que o cupom promocional também é de uso único?**
Para fechar uma brecha lógica. Se ele fosse reutilizável, um cupom de R$ 100,00 numa compra de R$ 50,00 geraria, pela RN0036, um cupom de troca de R$ 50,00 — e isso a cada uso, criando dinheiro do nada. A RN0033 limita a um promocional **por compra**; o uso único complementa isso.

**Como o cliente informa quanto paga em cada cartão?**
Ele não precisa calcular nada. Ao escolher um cartão, o valor a pagar inteiro vai para ele; ao adicionar um segundo, o valor é dividido igualmente entre os dois, e assim por diante. A divisão é feita em centavos e a sobra vai para os primeiros cartões — R$ 50,00 em três vira 16,67 + 16,67 + 16,66, que somam exatamente R$ 50,00. O cliente pode sobrescrever qualquer valor à mão, e o indicador "Falta pagar" fica verde quando a conta fecha. A redistribuição só acontece quando o conjunto de cartões muda ou quando o valor a pagar muda (cupom, frete, carrinho), nunca depois de uma digitação — senão desfaria o ajuste que o cliente acabou de fazer.

**O resumo mostra o efeito do cupom?**
Sim. Assim que um cupom é marcado, o painel de resumo passa a exibir, abaixo de Subtotal / Frete / Total, as linhas **Desconto em cupons** e **A pagar**. O desconto exibido é limitado ao total da compra: um cupom de R$ 70,00 numa compra de R$ 50,00 abate R$ 50,00, e o sistema avisa ali mesmo que os R$ 20,00 restantes virarão um cupom de troca (RN0036).

**Como o sistema lida com arredondamento de dinheiro?**
Todas as somas e comparações de valores acontecem em **centavos** (números inteiros), em `backend/dinheiro.js`. Isso não é preciosismo: a RN0034 pergunta "este cartão tem pelo menos R$ 10,00?" e a soma dos pagamentos tem de bater **exatamente** com o total. Em ponto flutuante, `0.1 + 0.2` dá `0.30000000000000004`, e um centavo de erro acumulado reprovaria uma compra correta.

**Por que o endereço cadastrado durante a compra é gravado mesmo quando o cliente não quer salvá-lo?**
Porque o pedido precisa apontar para onde foi entregue, senão a informação se perde. O registro é sempre criado, e a coluna `salvo_no_perfil` diz se ele também faz parte do perfil. Com `FALSE`, ele existe só para aquele pedido e não aparece na lista de endereços do cliente. O mesmo vale para o cartão.

**Por que SQL à mão e não um ORM?**
Para que toda consulta que a aplicação faz esteja escrita no código, visível. O ORM anterior (Hibernate) gerava as consultas a partir de anotações nas classes, e não havia como saber o que ia para o banco sem ligar o log — inclusive o problema N+1, que era invisível.

**E o risco de SQL injection?**
Os valores nunca são concatenados no texto do SQL. Entram como parâmetros (`$1`, `$2`...), que viajam separados e são combinados pelo banco. Um nome de cliente como `'; DROP TABLE tb_cliente; --` chega ao banco como texto a ser procurado, nunca como comando.

**Como o RNF0011 (resposta em até 1 segundo) é atendido?**
Listagens fazem 3 consultas no total, não uma por registro: `montarClientes()` e `buscarPedidos()` buscam os filhos de todos os registros de uma vez com `WHERE ... = ANY($1)` e agrupam em memória. Há índices em todas as chaves estrangeiras. Medido em ambiente de desenvolvimento, as consultas respondem entre 3ms e 10ms.

**Por que o cadastro e a finalização usam transação, e as outras rotas não?**
Porque elas gravam em várias tabelas. A finalização mexe em sete: sem `BEGIN`/`COMMIT`, uma falha no meio poderia deixar um pedido sem itens, um cupom marcado como usado sem a compra correspondente, ou o carrinho esvaziado sem pedido nenhum — estados que o cliente não conseguiria desfazer. As demais rotas fazem uma escrita só.

**Por que as rotas não têm `try/catch`?**
O Express 5 encaminha automaticamente os erros de funções `async` para o tratamento central no fim do `server.js`. As rotas lançam `erroDeRegra('...')` e o middleware responde `400` com a mensagem. Centralizar também garante que erro inesperado não vaze detalhe interno do banco para a tela.

**Por que a data de nascimento vem do banco como texto?**
`TO_CHAR(data_nascimento, 'YYYY-MM-DD')`. A tela joga o valor direto num `<input type="date">`, que só aceita esse formato. Se o driver devolvesse uma data, o JSON viraria `"1998-03-15T00:00:00.000Z"` e o campo apareceria vazio. Converter no SQL tira o fuso horário da conta.

**Por que não há tela de login?**
Não está no escopo dos módulos do DRS implementados até aqui. A aplicação guarda o `clienteId` no `localStorage` para saber de quem são os dados exibidos. A infraestrutura de senha (hash BCrypt, regra de senha forte, troca de senha) já está pronta para quando o login entrar.

**O que ficou de fora, e por quê?**
O enunciado desta fase exclui explicitamente: validação da operadora de cartão e mudanças de status após a finalização (RN0037–RN0040, RF0039, RF0040), baixa em estoque (RF0053, RN0028), bloqueio e expiração de itens no carrinho (RN0032, RN0044, RN0045, RNF0042) e todo o processo de troca (RF0041–RF0045, RN0041–RN0046). Por isso o pedido nasce e permanece `EM PROCESSAMENTO`, e o estoque não é decrementado. O cadastro de produtos (RF0011–RF0016) e a entrada em estoque (RF0051) são de outra fase: os produtos entram por `seed.sql`, como o enunciado permite.
