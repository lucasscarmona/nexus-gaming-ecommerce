package com.nexusgaming.ecommerce.dto;

import com.nexusgaming.ecommerce.domain.model.Genero;
import com.nexusgaming.ecommerce.domain.model.TipoTelefone;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;

import java.time.LocalDate;

/**
 * RF0022 - alteracao de dados cadastrais do cliente.
 * Nao inclui CPF (identidade do cliente nao muda), senha (RF0028/RNF0034 tem fluxo proprio)
 * nem enderecos/cartoes (RF0026/RF0027/RNF0034 tem fluxo proprio).
 */
public record ClienteAlterarRequest(
        @NotBlank(message = "O nome é obrigatório.")
        String nome,

        @NotNull(message = "O gênero é obrigatório.")
        Genero genero,

        @NotNull(message = "A data de nascimento é obrigatória.")
        @Past(message = "A data de nascimento deve estar no passado.")
        LocalDate dataNascimento,

        @NotNull(message = "O tipo de telefone é obrigatório.")
        TipoTelefone telefoneTipo,

        @NotBlank(message = "O DDD é obrigatório.")
        String telefoneDdd,

        @NotBlank(message = "O número de telefone é obrigatório.")
        String telefoneNumero,

        @NotBlank(message = "O e-mail é obrigatório.")
        @Email(message = "Formato de e-mail inválido.")
        String email
) {}
