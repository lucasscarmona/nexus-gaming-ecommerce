package com.nexusgaming.ecommerce.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Apenas o encoder de senha (RNF0033 - senha criptografada) e configurado aqui.
 * Nao usamos spring-boot-starter-security de proposito: o projeto ainda nao tem
 * um fluxo de login/autenticacao, e a starter completa bloquearia todos os
 * endpoints (inclusive o front-end estatico) com Basic Auth por padrao.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
