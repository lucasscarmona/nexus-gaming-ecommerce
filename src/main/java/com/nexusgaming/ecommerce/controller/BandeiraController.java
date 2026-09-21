package com.nexusgaming.ecommerce.controller;

import com.nexusgaming.ecommerce.dto.BandeiraResponse;
import com.nexusgaming.ecommerce.repository.BandeiraRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** RN0025 - lista as bandeiras de cartão de crédito registradas no domínio do sistema. */
@RestController
@RequestMapping("/api/bandeiras")
@CrossOrigin(origins = "*")
public class BandeiraController {

    private final BandeiraRepository repository;

    public BandeiraController(BandeiraRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<List<BandeiraResponse>> listar() {
        return ResponseEntity.ok(repository.findAll().stream().map(BandeiraResponse::daEntidade).toList());
    }
}
