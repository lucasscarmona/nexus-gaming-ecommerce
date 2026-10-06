const { defineConfig } = require("cypress");
const { consultar } = require("./backend/db");

module.exports = defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // Tasks rodam no Node (fora do navegador) e dão aos testes acesso direto
      // ao banco. São usadas só para PREPARAR o cenário, nunca para verificar
      // resultado: o que o teste verifica, ele verifica pela tela.
      on("task", {
        // O enunciado permite carregar previamente na base os cupons da
        // demonstração, já que a geração de cupom de troca (RF0045) é de outra
        // fase do DRS. Cada teste cria os seus porque todo cupom é de uso único.
        async criarCupom({ codigo, tipo, valor, clienteId }) {
          await consultar(
            "INSERT INTO tb_cupom (codigo, tipo, valor, cliente_id) VALUES ($1, $2, $3, $4)",
            [codigo, tipo, valor, clienteId || null]
          );
          return codigo;
        },

        // Deixa o estoque de um produto num valor conhecido, para o teste da
        // RN0031 não depender de quantas unidades sobraram de execuções
        // anteriores.
        async definirEstoque({ produtoId, quantidade }) {
          await consultar(
            "UPDATE tb_produto SET quantidade_estoque = $1 WHERE id = $2",
            [quantidade, produtoId]
          );
          return quantidade;
        },
      });
    },
  },
});
