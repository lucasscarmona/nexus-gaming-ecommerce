package com.nexusgaming.ecommerce.domain.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "tb_bandeira")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Bandeira {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String nome;
}
