package com.nexusgaming.ecommerce.domain.model;

import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Telefone {

    @Enumerated(EnumType.STRING)
    private TipoTelefone tipo;

    private String ddd;

    private String numero;
}
