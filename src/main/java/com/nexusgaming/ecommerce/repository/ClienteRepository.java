package com.nexusgaming.ecommerce.repository;

import com.nexusgaming.ecommerce.domain.model.Cliente;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {
    List<Cliente> findAllByAtivoTrue();
    Optional<Cliente> findByEmail(String email);
    Optional<Cliente> findByCpf(String cpf);
}