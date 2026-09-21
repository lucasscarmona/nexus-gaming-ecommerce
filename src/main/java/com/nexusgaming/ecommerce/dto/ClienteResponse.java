package com.nexusgaming.ecommerce.dto;

import com.nexusgaming.ecommerce.domain.model.Cliente;
import com.nexusgaming.ecommerce.domain.model.Genero;
import com.nexusgaming.ecommerce.domain.model.TipoTelefone;

import java.time.LocalDate;
import java.util.List;

public record ClienteResponse(
        Long id,
        String nome,
        Genero genero,
        String cpf,
        LocalDate dataNascimento,
        TipoTelefone telefoneTipo,
        String telefoneDdd,
        String telefoneNumero,
        String email,
        boolean ativo,
        List<EnderecoResponse> enderecos,
        List<CartaoCreditoResponse> cartoes
) {
    public static ClienteResponse daEntidade(Cliente cliente) {
        return new ClienteResponse(
                cliente.getId(),
                cliente.getNome(),
                cliente.getGenero(),
                cliente.getCpf(),
                cliente.getDataNascimento(),
                cliente.getTelefone() != null ? cliente.getTelefone().getTipo() : null,
                cliente.getTelefone() != null ? cliente.getTelefone().getDdd() : null,
                cliente.getTelefone() != null ? cliente.getTelefone().getNumero() : null,
                cliente.getEmail(),
                cliente.isAtivo(),
                cliente.getEnderecos().stream().map(EnderecoResponse::daEntidade).toList(),
                cliente.getCartoes().stream().map(CartaoCreditoResponse::daEntidade).toList()
        );
    }
}
