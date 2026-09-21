package com.nexusgaming.ecommerce.dto;

import com.nexusgaming.ecommerce.domain.model.Bandeira;

public record BandeiraResponse(Long id, String nome) {
    public static BandeiraResponse daEntidade(Bandeira bandeira) {
        return new BandeiraResponse(bandeira.getId(), bandeira.getNome());
    }
}
