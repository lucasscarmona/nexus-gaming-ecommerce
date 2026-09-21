-- RNF0013 - script de implantacao que popula as tabelas de dominio do sistema.
INSERT INTO tb_bandeira (nome) VALUES ('Visa') ON CONFLICT (nome) DO NOTHING;
INSERT INTO tb_bandeira (nome) VALUES ('Mastercard') ON CONFLICT (nome) DO NOTHING;
INSERT INTO tb_bandeira (nome) VALUES ('Elo') ON CONFLICT (nome) DO NOTHING;
INSERT INTO tb_bandeira (nome) VALUES ('American Express') ON CONFLICT (nome) DO NOTHING;
INSERT INTO tb_bandeira (nome) VALUES ('Hipercard') ON CONFLICT (nome) DO NOTHING;
