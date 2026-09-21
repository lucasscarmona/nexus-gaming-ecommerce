package com.nexusgaming.ecommerce.dto;

import com.nexusgaming.ecommerce.domain.model.TipoEndereco;
import jakarta.validation.constraints.NotBlank;

public record EnderecoRequest(
        @NotBlank(message = "A identificação do endereço é obrigatória.")
        String nome,

        @NotBlank(message = "O logradouro é obrigatório.")
        String logradouro,

        @NotBlank(message = "O número é obrigatório.")
        String numero,

        String complemento,

        @NotBlank(message = "O bairro é obrigatório.")
        String bairro,

        @NotBlank(message = "O CEP é obrigatório.")
        String cep,

        @NotBlank(message = "A cidade é obrigatória.")
        String cidade,

        @NotBlank(message = "O estado é obrigatório.")
        String estado,

        @NotBlank(message = "O país é obrigatório.")
        String pais,

        String observacoes,

        TipoEndereco tipoEndereco
) {}
