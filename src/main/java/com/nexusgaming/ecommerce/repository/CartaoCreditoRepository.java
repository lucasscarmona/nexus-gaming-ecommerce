package com.nexusgaming.ecommerce.repository;

import com.nexusgaming.ecommerce.domain.model.CartaoCredito;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CartaoCreditoRepository extends JpaRepository<CartaoCredito, Long> {
    List<CartaoCredito> findAllByClienteId(Long clienteId);
}
