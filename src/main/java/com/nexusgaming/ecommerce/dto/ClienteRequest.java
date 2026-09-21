package com.nexusgaming.ecommerce.dto;

import com.nexusgaming.ecommerce.domain.model.Genero;
import com.nexusgaming.ecommerce.domain.model.TipoTelefone;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.LocalDate;

/**
 * RF0021 / RN0026 - dados obrigatorios para o cadastro de um cliente:
 * genero, nome, data de nascimento, cpf, telefone (tipo + ddd + numero), e-mail,
 * senha e ao menos um endereco (RN0021 cobranca + RN0022 entrega, aqui atendidos
 * por um unico endereco do tipo AMBOS quando nao especificado).
 * O cartao de credito (RF0027) e opcional neste momento do cadastro.
 */
public record ClienteRequest(
        @NotBlank(message = "O nome é obrigatório.")
        String nome,

        @NotNull(message = "O gênero é obrigatório.")
        Genero genero,

        @NotBlank(message = "O CPF é obrigatório.")
        String cpf,

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
        String email,

        @NotBlank(message = "A senha é obrigatória.")
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*(),.?\":{}|<>_\\-]).{8,}$",
                message = "A senha deve ter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas e um caractere especial."
        )
        String senha,

        @NotBlank(message = "A confirmação de senha é obrigatória.")
        String confirmacaoSenha,

        @NotNull(message = "É obrigatório informar ao menos um endereço.")
        @Valid
        EnderecoRequest endereco,

        @Valid
        CartaoCreditoRequest cartao
) {}
