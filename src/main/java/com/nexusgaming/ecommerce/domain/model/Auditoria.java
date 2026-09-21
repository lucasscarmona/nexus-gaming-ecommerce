package com.nexusgaming.ecommerce.domain.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * RNF0012 - registra data, hora, usuario responsavel e um resumo dos dados
 * alterados para toda operacao de escrita (insercao ou alteracao).
 */
@Entity
@Table(name = "tb_auditoria")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Auditoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 60)
    private String entidade;

    @Column(nullable = false)
    private Long entidadeId;

    @Column(nullable = false, length = 30)
    private String operacao;

    @Column(nullable = false, length = 60)
    private String usuarioResponsavel;

    @Column(nullable = false)
    private LocalDateTime dataHora;

    @Column(nullable = false, length = 500)
    private String detalhes;
}
