package com.nexusgaming.ecommerce.dto;

import com.nexusgaming.ecommerce.domain.model.Cliente;
import java.time.LocalDate;

public record ClienteResponse(Long id, String nome, String cpf, LocalDate dataNascimento, String email, String telefone, boolean ativo) {
    public static ClienteResponse daEntidade(Cliente cliente) {
        return new ClienteResponse(
                cliente.getId(), cliente.getNome(), cliente.getCpf(),
                cliente.getDataNascimento(), cliente.getEmail(), cliente.getTelefone(), cliente.isAtivo()
        );
    }
}