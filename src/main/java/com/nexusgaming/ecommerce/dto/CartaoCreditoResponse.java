package com.nexusgaming.ecommerce.dto;

import com.nexusgaming.ecommerce.domain.model.CartaoCredito;

public record CartaoCreditoResponse(
        Long id,
        String numeroMascarado,
        String nomeImpresso,
        String validade,
        String bandeira,
        boolean preferencial
) {
    public static CartaoCreditoResponse daEntidade(CartaoCredito cartao) {
        String numero = cartao.getNumero();
        String mascarado = numero.length() >= 4
                ? "**** **** **** " + numero.substring(numero.length() - 4)
                : "****";
        return new CartaoCreditoResponse(
                cartao.getId(), mascarado, cartao.getNomeImpresso(), cartao.getValidade(),
                cartao.getBandeira().getNome(), cartao.isPreferencial()
        );
    }
}
