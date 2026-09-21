# CLAUDE.md

Este arquivo fornece orientações ao Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Idioma

Todas as respostas ao usuário devem ser em português (PT-BR), independentemente do idioma da instrução recebida. Este arquivo (CLAUDE.md) também deve sempre permanecer em português — ao editá-lo, mantenha o conteúdo traduzido.

## Visão geral do projeto

Nexus Gaming Gear — um protótipo de e-commerce de periféricos gamer. Backend REST em Spring Boot 4.1.1 (Java 21) servindo um front-end estático em HTML/Tailwind/JS puro, com testes E2E em Cypress cobrindo o fluxo de CRUD de clientes. É um projeto acadêmico/de avaliação (os entregáveis DVP — Documento de Visão do Produto — e DRS ficam em `docs/`).

## Comandos

### Backend (Maven / Spring Boot)
- Rodar a aplicação: `./mvnw spring-boot:run` (Windows: `mvnw.cmd spring-boot:run`) — serve em `http://localhost:8080`, e também serve o front-end estático em `/` (`src/main/resources/static/index.html`).
- Build: `./mvnw clean package`
- Rodar todos os testes: `./mvnw test`
- Rodar uma única classe de teste: `./mvnw test -Dtest=EcommerceApplicationTests`
- Requer uma instância local do PostgreSQL compatível com `src/main/resources/application.properties` (banco `nexus_gaming_db`, usuário/senha `postgres`/`postgres` em `localhost:5432`). `spring.jpa.hibernate.ddl-auto=update` cria/atualiza o schema automaticamente — não há etapa separada de migração.

### Front-end / E2E (Cypress)
- Instalar dependências: `npm install`
- Abrir o runner do Cypress: `npx cypress open`
- Rodar em modo headless: `npx cypress run`
- Os testes Cypress assumem que a aplicação Spring Boot já está rodando em `http://localhost:8080` (`cy.visit('http://localhost:8080')` no `beforeEach`) — suba o backend antes.
- Não há build/dev server separado para o front-end; `npm test` não está configurado (o script `test` do package.json é um placeholder).

## Arquitetura

- **Pacote raiz**: `com.nexusgaming.ecommerce`, organizado em camadas `controller` → `service` → `repository` → `domain.model`, com DTOs de request/response em `dto`. Até o momento só existe uma fatia de domínio: `Cliente`.
- **Superfície da API**: `ClienteController` expõe `/api/clientes` (POST para cadastrar, GET para listar ativos, GET por id, PUT para alterar, PATCH `/{id}/inativar` para soft delete). O CORS está totalmente aberto (`@CrossOrigin(origins = "*")`) porque o front-end atualmente chama a API via URLs absolutas (`http://localhost:8080/api/...`) a partir do JS estático.
- **Padrão de soft delete**: `Cliente` tem um booleano `ativo` em vez de ser fisicamente excluído; `ClienteService.inativar()` o altera via `Cliente.inativar()`, e `listarAtivos()` filtra através de `ClienteRepository.findAllByAtivoTrue()`. A exclusão física é intencionalmente não exposta — preserve esse padrão ao adicionar outras entidades no futuro.
- **Tratamento de erros**: falhas de regra de negócio (CPF duplicado, cliente não encontrado) lançam `IllegalArgumentException` simples a partir de `ClienteService` — ainda não há `@ControllerAdvice`/handler global de exceções, então atualmente isso resulta em 500 genérico a menos que um handler seja adicionado.
- **Validação**: a validação do lado do request está nas anotações `jakarta.validation` do record `ClienteRequest`, com mensagens em português; mantenha novos DTOs consistentes com isso (Bean Validation em records, mensagens em PT-BR).
- **Entidades** usam Lombok (`@Getter/@Setter/@NoArgsConstructor/@AllArgsConstructor/@Builder`) em vez de boilerplate escrito manualmente.
- **Front-end** (`src/main/resources/static/index.html`) é um único arquivo HTML estático — Tailwind via CDN, Chart.js via CDN, Font Awesome via CDN, e funções `<script>` inline puras (`switchView`, `cadastrarCliente`, `atualizarCliente`, `inativarContaCliente`) que fazem a troca de views e chamadas `fetch()` diretamente ao backend. Não há bundler, framework ou sistema de módulos no front-end — novo trabalho de UI deve seguir essa mesma convenção de JS puro em script inline, a menos que o projeto seja explicitamente reestruturado.
- **Cobertura E2E** (`cypress/e2e/crud-cliente.cy.js`) exercita a UI de ponta a ponta contra a aplicação em execução (cadastro → edição → soft-delete/inativação), verificando o texto de `window:alert` e, para a inativação, uma checagem posterior via `GET /api/clientes`. Os seletores de elementos são ids simples (`#cad-nome`, `#edit-nome`, `#btn-inativar`, etc.) — mantenha esses ids estáveis em `index.html` ao refatorar o front-end, ou atualize o spec junto.
