// =============================================================================
// GET /api/bandeiras
//
// Unico endpoint do arquivo, e so de leitura. Bandeira e uma tabela de dominio:
// quem a popula e o seed.sql (RNF0013), nunca o usuario. Por isso aqui nao
// existe POST, PUT nem DELETE.
//
// Quem consome: o <select> de bandeira das telas de cadastro de cliente e de
// cartao. Montando o select a partir do banco, o cliente so consegue escolher
// uma bandeira que a loja aceita de fato (RN0025) -- a tela nao tem uma lista
// propria que possa ficar desatualizada em relacao ao banco.
// =============================================================================

const express = require('express');
const { consultar } = require('./db');

const rotas = express.Router();

rotas.get('/', async (requisicao, resposta) => {
    const bandeiras = await consultar('SELECT id, nome FROM tb_bandeira ORDER BY nome');
    resposta.json(bandeiras);
});

module.exports = rotas;
