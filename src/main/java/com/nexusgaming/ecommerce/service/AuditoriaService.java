package com.nexusgaming.ecommerce.service;

import com.nexusgaming.ecommerce.domain.model.Auditoria;
import com.nexusgaming.ecommerce.repository.AuditoriaRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/** RNF0012 - log de transacao para toda operacao de escrita (insercao ou alteracao). */
@Service
public class AuditoriaService {

    private final AuditoriaRepository repository;

    public AuditoriaService(AuditoriaRepository repository) {
        this.repository = repository;
    }

    public void registrar(String entidade, Long entidadeId, String operacao, String usuarioResponsavel, String detalhes) {
        Auditoria auditoria = Auditoria.builder()
                .entidade(entidade)
                .entidadeId(entidadeId)
                .operacao(operacao)
                .usuarioResponsavel(usuarioResponsavel)
                .dataHora(LocalDateTime.now())
                .detalhes(detalhes)
                .build();
        repository.save(auditoria);
    }
}
