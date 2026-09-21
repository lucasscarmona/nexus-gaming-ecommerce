package com.nexusgaming.ecommerce.dto;

import jakarta.validation.constraints.NotBlank;

public record CartaoCreditoRequest(
        @NotBlank(message = "O número do cartão é obrigatório.")
        String numero,

        @NotBlank(message = "O nome impresso no cartão é obrigatório.")
        String nomeImpresso,

        @NotBlank(message = "A data de validade do cartão é obrigatória.")
        String validade,

        @NotBlank(message = "A bandeira do cartão é obrigatória.")
        String bandeira,

        @NotBlank(message = "O código de segurança é obrigatório.")
        String codigoSeguranca,

        boolean preferencial
) {}
