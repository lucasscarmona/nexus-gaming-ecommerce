package com.nexusgaming.ecommerce.repository;

import com.nexusgaming.ecommerce.domain.model.Bandeira;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface BandeiraRepository extends JpaRepository<Bandeira, Long> {
    Optional<Bandeira> findByNomeIgnoreCase(String nome);
}
