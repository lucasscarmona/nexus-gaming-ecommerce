package com.nexusgaming.ecommerce.domain.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tb_cartao_credito")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartaoCredito {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @Column(nullable = false, length = 19)
    private String numero;

    @Column(nullable = false, length = 120)
    private String nomeImpresso;

    @Column(nullable = false, length = 5)
    private String validade;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bandeira_id", nullable = false)
    private Bandeira bandeira;

    @Column(nullable = false, length = 4)
    private String codigoSeguranca;

    @Column(nullable = false)
    private boolean preferencial;
}
