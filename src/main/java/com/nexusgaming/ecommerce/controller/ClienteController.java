package com.nexusgaming.ecommerce.controller;

import com.nexusgaming.ecommerce.dto.*;
import com.nexusgaming.ecommerce.service.ClienteService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/clientes")
@CrossOrigin(origins = "*")
public class ClienteController {

    private final ClienteService service;

    public ClienteController(ClienteService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<ClienteResponse> cadastrar(@RequestBody @Valid ClienteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.cadastrar(request));
    }

    /** RF0024 - sem parametros retorna os clientes ativos; com parametros, filtra por qualquer campo. */
    @GetMapping
    public ResponseEntity<List<ClienteResponse>> listar(
            @RequestParam(required = false) String nome,
            @RequestParam(required = false) String cpf,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String telefone,
            @RequestParam(required = false) Boolean ativo) {
        boolean semFiltro = nome == null && cpf == null && email == null && telefone == null && ativo == null;
        if (semFiltro) {
            return ResponseEntity.ok(service.listarAtivos());
        }
        return ResponseEntity.ok(service.filtrar(nome, cpf, email, telefone, ativo));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClienteResponse> buscar(@PathVariable Long id) {
        return ResponseEntity.ok(service.buscarPorId(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClienteResponse> alterar(@PathVariable Long id, @RequestBody @Valid ClienteAlterarRequest request) {
        return ResponseEntity.ok(service.alterar(id, request));
    }

    @PatchMapping("/{id}/inativar")
    public ResponseEntity<Void> inativar(@PathVariable Long id) {
        service.inativar(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/senha")
    public ResponseEntity<Void> alterarSenha(@PathVariable Long id, @RequestBody @Valid AlterarSenhaRequest request) {
        service.alterarSenha(id, request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/enderecos")
    public ResponseEntity<EnderecoResponse> adicionarEndereco(@PathVariable Long id, @RequestBody @Valid EnderecoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.adicionarEndereco(id, request));
    }

    @GetMapping("/{id}/enderecos")
    public ResponseEntity<List<EnderecoResponse>> listarEnderecos(@PathVariable Long id) {
        return ResponseEntity.ok(service.listarEnderecos(id));
    }

    @PutMapping("/{id}/enderecos/{enderecoId}")
    public ResponseEntity<EnderecoResponse> alterarEndereco(@PathVariable Long id, @PathVariable Long enderecoId,
                                                              @RequestBody @Valid EnderecoRequest request) {
        return ResponseEntity.ok(service.alterarEndereco(id, enderecoId, request));
    }

    @PostMapping("/{id}/cartoes")
    public ResponseEntity<CartaoCreditoResponse> adicionarCartao(@PathVariable Long id, @RequestBody @Valid CartaoCreditoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.adicionarCartao(id, request));
    }

    @GetMapping("/{id}/cartoes")
    public ResponseEntity<List<CartaoCreditoResponse>> listarCartoes(@PathVariable Long id) {
        return ResponseEntity.ok(service.listarCartoes(id));
    }
}
