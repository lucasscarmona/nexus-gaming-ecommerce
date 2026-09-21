package com.nexusgaming.ecommerce.dto;

import com.nexusgaming.ecommerce.domain.model.Endereco;
import com.nexusgaming.ecommerce.domain.model.TipoEndereco;

public record EnderecoResponse(
        Long id,
        String nome,
        String logradouro,
        String numero,
        String complemento,
        String bairro,
        String cep,
        String cidade,
        String estado,
        String pais,
        String observacoes,
        TipoEndereco tipoEndereco
) {
    public static EnderecoResponse daEntidade(Endereco endereco) {
        return new EnderecoResponse(
                endereco.getId(), endereco.getNome(), endereco.getLogradouro(), endereco.getNumero(),
                endereco.getComplemento(), endereco.getBairro(), endereco.getCep(), endereco.getCidade(),
                endereco.getEstado(), endereco.getPais(), endereco.getObservacoes(), endereco.getTipoEndereco()
        );
    }
}
