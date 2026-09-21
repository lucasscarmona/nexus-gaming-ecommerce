package com.nexusgaming.ecommerce.repository;

import com.nexusgaming.ecommerce.domain.model.Cliente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ClienteRepository extends JpaRepository<Cliente, Long> {
    List<Cliente> findAllByAtivoTrue();
    Optional<Cliente> findByEmail(String email);
    Optional<Cliente> findByCpf(String cpf);

    /**
     * RF0024 - consulta de clientes por filtro. Todos os campos podem ser usados
     * de forma combinada ou isolada; um parametro nulo/vazio nao restringe a busca.
     */
    @Query("SELECT c FROM Cliente c WHERE " +
            "(:nome IS NULL OR :nome = '' OR LOWER(c.nome) LIKE LOWER(CONCAT('%', :nome, '%'))) AND " +
            "(:cpf IS NULL OR :cpf = '' OR c.cpf = :cpf) AND " +
            "(:email IS NULL OR :email = '' OR LOWER(c.email) LIKE LOWER(CONCAT('%', :email, '%'))) AND " +
            "(:telefone IS NULL OR :telefone = '' OR c.telefone.numero LIKE CONCAT('%', :telefone, '%')) AND " +
            "(:ativo IS NULL OR c.ativo = :ativo)")
    List<Cliente> buscarComFiltro(@Param("nome") String nome,
                                   @Param("cpf") String cpf,
                                   @Param("email") String email,
                                   @Param("telefone") String telefone,
                                   @Param("ativo") Boolean ativo);
}
