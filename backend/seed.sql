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
