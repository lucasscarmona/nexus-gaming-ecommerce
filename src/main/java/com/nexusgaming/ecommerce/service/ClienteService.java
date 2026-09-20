package com.nexusgaming.ecommerce.service;

import com.nexusgaming.ecommerce.domain.model.Cliente;
import com.nexusgaming.ecommerce.dto.ClienteRequest;
import com.nexusgaming.ecommerce.dto.ClienteResponse;
import com.nexusgaming.ecommerce.repository.ClienteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class ClienteService {

    private final ClienteRepository repository;

    public ClienteService(ClienteRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public ClienteResponse cadastrar(ClienteRequest request) {
        if (repository.findByCpf(request.cpf()).isPresent()) {
            throw new IllegalArgumentException("CPF já cadastrado.");
        }

        Cliente cliente = Cliente.builder()
                .nome(request.nome())
                .cpf(request.cpf())
                .dataNascimento(request.dataNascimento())
                .email(request.email())
                .telefone(request.telefone())
                .ativo(true)
                .build();

        return ClienteResponse.daEntidade(repository.save(cliente));
    }

    public List<ClienteResponse> listarAtivos() {
        return repository.findAllByAtivoTrue().stream()
                .map(ClienteResponse::daEntidade)
                .toList();
    }

    public ClienteResponse buscarPorId(Long id) {
        Cliente cliente = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado."));
        return ClienteResponse.daEntidade(cliente);
    }

    @Transactional
    public ClienteResponse alterar(Long id, ClienteRequest request) {
        Cliente cliente = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado."));

        cliente.setNome(request.nome());
        cliente.setDataNascimento(request.dataNascimento());
        cliente.setEmail(request.email());
        cliente.setTelefone(request.telefone());

        return ClienteResponse.daEntidade(repository.save(cliente));
    }

    @Transactional
    public void inativar(Long id) {
        Cliente cliente = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado."));

        cliente.inativar();
        repository.save(cliente);
    }
}