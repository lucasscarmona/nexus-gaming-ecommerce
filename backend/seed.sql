-- =============================================================================
-- RNF0013 - script de implantacao: popula as tabelas de dominio do sistema.
--
-- Bandeiras nao sao cadastradas pelo usuario, elas fazem parte das regras da
-- loja (RN0025). Entao precisam existir antes do primeiro cliente usar o
-- sistema, e e este arquivo que garante isso.
--
-- ON CONFLICT DO NOTHING: se a bandeira ja existe, o INSERT e ignorado em vez
-- de dar erro. E isso que torna seguro rodar este script a cada vez que o
-- servidor sobe.
-- =============================================================================
INSERT INTO tb_bandeira (nome) VALUES
    ('Visa'),
    ('Mastercard'),
    ('Elo'),
    ('American Express'),
    ('Hipercard')
ON CONFLICT (nome) DO NOTHING;

-- =============================================================================
-- FASE 2 - dados que o enunciado exige que existam previamente na base
-- =============================================================================

-- Catalogo e estoque.
--
-- O cadastro de produto (RF0011-RF0016) e a entrada em estoque (RF0051) sao de
-- outra fase do DRS. Como a demonstracao de criacao de pedido precisa de
-- produtos com estoque, eles entram por aqui.
--
-- O "Nexus Glide Control" custa R$ 36,00 de proposito: 1 unidade entregue em SP
-- da frete de R$ 14,00 (10,00 da regiao + 4,00 do item) e total de R$ 50,00 --
-- exatamente o valor do exemplo da RN0036 no DRS, o que deixa a demonstracao do
-- cupom de troca identica ao texto do requisito.
INSERT INTO tb_produto (nome, categoria, descricao, preco, quantidade_estoque, icone) VALUES
    ('Nexus Strike Pro RGB',    'Teclado Mecanico', 'Switches lineares opticos, tempo de resposta 0.2ms.',        899.00, 15, 'fa-keyboard'),
    ('Nexus AimBot UltraLight', 'Mouse Wireless',   'Sensor 30K DPI, apenas 55g. Bateria para 80h.',              649.00, 20, 'fa-computer-mouse'),
    ('Nexus Echo Surround',     'Headset 7.1',      'Drivers de 50mm, audio espacial e microfone flip-to-mute.',  549.00, 12, 'fa-headset'),
    ('Nexus Pulse 240Hz',       'Monitor',          'IPS 27 polegadas, 240Hz, 1ms, HDR400.',                     2199.00,  5, 'fa-display'),
    ('Nexus Cam Stream 4K',     'Webcam',           'Captura 4K60, foco automatico e correcao de luz.',           459.00,  8, 'fa-video'),
    ('Nexus Grip Controller',   'Controle',         'Gatilhos hall effect e paddles traseiros programaveis.',     349.00,  3, 'fa-gamepad'),
    ('Nexus Glide Control',     'Mousepad',         'Superficie de controle 450x400mm, base antiderrapante.',      36.00, 50, 'fa-square'),
    ('Nexus Hub USB-C',         'Acessorio',        'Hub 6 em 1 com HDMI 4K60 e entrega de energia de 100W.',      20.00, 40, 'fa-plug')
ON CONFLICT (nome) DO NOTHING;

-- Ilustracao de cada produto.
--
-- Vem num UPDATE separado, e nao na lista do INSERT acima, porque o INSERT usa
-- ON CONFLICT DO NOTHING: os produtos ja cadastrados seriam ignorados e
-- ficariam sem imagem. O UPDATE alcanca todos, novos e antigos, e e igualmente
-- seguro de rodar quantas vezes quiser.
UPDATE tb_produto SET imagem = 'imagens/produtos/teclado.svg'  WHERE nome = 'Nexus Strike Pro RGB';
UPDATE tb_produto SET imagem = 'imagens/produtos/mouse.svg'    WHERE nome = 'Nexus AimBot UltraLight';
UPDATE tb_produto SET imagem = 'imagens/produtos/headset.svg'  WHERE nome = 'Nexus Echo Surround';
UPDATE tb_produto SET imagem = 'imagens/produtos/monitor.svg'  WHERE nome = 'Nexus Pulse 240Hz';
UPDATE tb_produto SET imagem = 'imagens/produtos/webcam.svg'   WHERE nome = 'Nexus Cam Stream 4K';
UPDATE tb_produto SET imagem = 'imagens/produtos/controle.svg' WHERE nome = 'Nexus Grip Controller';
UPDATE tb_produto SET imagem = 'imagens/produtos/mousepad.svg' WHERE nome = 'Nexus Glide Control';
UPDATE tb_produto SET imagem = 'imagens/produtos/hub.svg'      WHERE nome = 'Nexus Hub USB-C';

-- Cupons promocionais para a demonstracao ao vivo (cliente_id NULL = vale para
-- qualquer cliente). Os cupons de troca pertencem a um cliente especifico e
-- nascem de uma devolucao (RF0045, outra fase) ou do troco da RN0036 -- por isso
-- nao entram no seed: os testes criam os seus com cy.task('criarCupom').
--
-- TODO cupom e de uso unico, promocional inclusive: apos a compra ele vira
-- usado = TRUE. Sem isso haveria uma brecha logica -- um cupom promocional
-- reutilizavel de R$ 100,00 numa compra de R$ 50,00 geraria, pela RN0036, um
-- cupom de troca de R$ 50,00 a cada uso, criando dinheiro do nada.
--
-- Os valores 20, 40 e 35 sao os do exemplo da RN0036 no DRS. Ha copias
-- numeradas de cada um porque o cupom e consumido ao ser usado: se precisar
-- repetir a demonstracao, use o proximo codigo da sequencia.
INSERT INTO tb_cupom (codigo, tipo, valor, cliente_id) VALUES
    ('PROMO20-A',  'PROMOCIONAL',  20.00, NULL),
    ('PROMO20-B',  'PROMOCIONAL',  20.00, NULL),
    ('PROMO20-C',  'PROMOCIONAL',  20.00, NULL),
    ('PROMO35-A',  'PROMOCIONAL',  35.00, NULL),
    ('PROMO35-B',  'PROMOCIONAL',  35.00, NULL),
    ('PROMO35-C',  'PROMOCIONAL',  35.00, NULL),
    ('PROMO40-A',  'PROMOCIONAL',  40.00, NULL),
    ('PROMO40-B',  'PROMOCIONAL',  40.00, NULL),
    ('PROMO40-C',  'PROMOCIONAL',  40.00, NULL),
    ('NEXUS100-A', 'PROMOCIONAL', 100.00, NULL),
    ('NEXUS100-B', 'PROMOCIONAL', 100.00, NULL)
ON CONFLICT (codigo) DO NOTHING;
