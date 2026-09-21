package com.nexusgaming.ecommerce.service;

import com.nexusgaming.ecommerce.domain.model.*;
import com.nexusgaming.ecommerce.dto.*;
import com.nexusgaming.ecommerce.repository.BandeiraRepository;
import com.nexusgaming.ecommerce.repository.CartaoCreditoRepository;
import com.nexusgaming.ecommerce.repository.ClienteRepository;
import com.nexusgaming.ecommerce.repository.EnderecoRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ClienteService {

    private final ClienteRepository repository;
    private final EnderecoRepository enderecoRepository;
    private final CartaoCreditoRepository cartaoRepository;
    private final BandeiraRepository bandeiraRepository;
    private final AuditoriaService auditoriaService;
    private final PasswordEncoder passwordEncoder;

    public ClienteService(ClienteRepository repository, EnderecoRepository enderecoRepository,
                           CartaoCreditoRepository cartaoRepository, BandeiraRepository bandeiraRepository,
                           AuditoriaService auditoriaService, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.enderecoRepository = enderecoRepository;
        this.cartaoRepository = cartaoRepository;
        this.bandeiraRepository = bandeiraRepository;
        this.auditoriaService = auditoriaService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public ClienteResponse cadastrar(ClienteRequest request) {
        if (repository.findByCpf(request.cpf()).isPresent()) {
            throw new IllegalArgumentException("CPF já cadastrado.");
        }
        if (repository.findByEmail(request.email()).isPresent()) {
            throw new IllegalArgumentException("E-mail já cadastrado.");
        }
        if (!request.senha().equals(request.confirmacaoSenha())) {
            throw new IllegalArgumentException("A senha e a confirmação de senha não conferem.");
        }

        Cliente cliente = Cliente.builder()
                .nome(request.nome())
                .genero(request.genero())
                .cpf(request.cpf())
                .dataNascimento(request.dataNascimento())
                .telefone(new Telefone(request.telefoneTipo(), request.telefoneDdd(), request.telefoneNumero()))
                .email(request.email())
                .senha(passwordEncoder.encode(request.senha()))
                .ativo(true)
                .build();

        // RN0021 + RN0022: um unico endereco do tipo AMBOS ja atende cobranca e entrega
        // quando o cliente nao distingue endereco de cobranca e de entrega no cadastro.
        EnderecoRequest enderecoRequest = request.endereco().tipoEndereco() != null
                ? request.endereco()
                : new EnderecoRequest(
                        request.endereco().nome(), request.endereco().logradouro(), request.endereco().numero(),
                        request.endereco().complemento(), request.endereco().bairro(), request.endereco().cep(),
                        request.endereco().cidade(), request.endereco().estado(), request.endereco().pais(),
                        request.endereco().observacoes(), TipoEndereco.AMBOS);
        cliente.getEnderecos().add(construirEndereco(enderecoRequest, cliente));

        if (request.cartao() != null) {
            cliente.getCartoes().add(construirCartao(request.cartao(), cliente, true));
        }

        Cliente salvo = repository.save(cliente);
        auditoriaService.registrar("Cliente", salvo.getId(), "CRIACAO", "cliente-" + salvo.getId(), "Cadastro de cliente realizado (RF0021)");
        return ClienteResponse.daEntidade(salvo);
    }

    public List<ClienteResponse> listarAtivos() {
        return repository.findAllByAtivoTrue().stream()
                .map(ClienteResponse::daEntidade)
                .toList();
    }

    /** RF0024 - consulta por filtro, combinando qualquer campo de forma isolada ou conjunta. */
    public List<ClienteResponse> filtrar(String nome, String cpf, String email, String telefone, Boolean ativo) {
        return repository.buscarComFiltro(nome, cpf, email, telefone, ativo).stream()
                .map(ClienteResponse::daEntidade)
                .toList();
    }

    public ClienteResponse buscarPorId(Long id) {
        return ClienteResponse.daEntidade(buscarClienteOuLancar(id));
    }

    @Transactional
    public ClienteResponse alterar(Long id, ClienteAlterarRequest request) {
        Cliente cliente = buscarClienteOuLancar(id);

        cliente.setNome(request.nome());
        cliente.setGenero(request.genero());
        cliente.setDataNascimento(request.dataNascimento());
        cliente.setTelefone(new Telefone(request.telefoneTipo(), request.telefoneDdd(), request.telefoneNumero()));
        cliente.setEmail(request.email());

        Cliente salvo = repository.save(cliente);
        auditoriaService.registrar("Cliente", id, "ALTERACAO", "cliente-" + id, "Dados cadastrais alterados (RF0022)");
        return ClienteResponse.daEntidade(salvo);
    }

    @Transactional
    public void inativar(Long id) {
        Cliente cliente = buscarClienteOuLancar(id);
        cliente.inativar();
        repository.save(cliente);
        auditoriaService.registrar("Cliente", id, "INATIVACAO", "cliente-" + id, "Cliente inativado - soft delete (RF0023)");
    }

    /** RF0028 / RNF0031-0033 - troca de senha isolada, sem exigir os demais dados cadastrais. */
    @Transactional
    public void alterarSenha(Long id, AlterarSenhaRequest request) {
        if (!request.novaSenha().equals(request.confirmacaoSenha())) {
            throw new IllegalArgumentException("A nova senha e a confirmação não conferem.");
        }
        Cliente cliente = buscarClienteOuLancar(id);
        cliente.setSenha(passwordEncoder.encode(request.novaSenha()));
        repository.save(cliente);
        auditoriaService.registrar("Cliente", id, "ALTERACAO_SENHA", "cliente-" + id, "Senha alterada (RF0028)");
    }

    /** RF0026 - associa mais um endereço ao cliente. */
    @Transactional
    public EnderecoResponse adicionarEndereco(Long clienteId, EnderecoRequest request) {
        Cliente cliente = buscarClienteOuLancar(clienteId);
        Endereco endereco = construirEndereco(request, cliente);
        enderecoRepository.save(endereco);
        auditoriaService.registrar("Endereco", endereco.getId(), "CRIACAO", "cliente-" + clienteId, "Endereço adicionado (RF0026)");
        return EnderecoResponse.daEntidade(endereco);
    }

    public List<EnderecoResponse> listarEnderecos(Long clienteId) {
        buscarClienteOuLancar(clienteId);
        return enderecoRepository.findAllByClienteId(clienteId).stream().map(EnderecoResponse::daEntidade).toList();
    }

    /** RNF0034 - altera apenas o endereço informado, sem tocar nos demais dados do cliente. */
    @Transactional
    public EnderecoResponse alterarEndereco(Long clienteId, Long enderecoId, EnderecoRequest request) {
        Endereco endereco = enderecoRepository.findById(enderecoId)
                .filter(e -> e.getCliente().getId().equals(clienteId))
                .orElseThrow(() -> new IllegalArgumentException("Endereço não encontrado para este cliente."));

        endereco.setNome(request.nome());
        endereco.setLogradouro(request.logradouro());
        endereco.setNumero(request.numero());
        endereco.setComplemento(request.complemento());
        endereco.setBairro(request.bairro());
        endereco.setCep(request.cep());
        endereco.setCidade(request.cidade());
        endereco.setEstado(request.estado());
        endereco.setPais(request.pais());
        endereco.setObservacoes(request.observacoes());
        endereco.setTipoEndereco(request.tipoEndereco() != null ? request.tipoEndereco() : endereco.getTipoEndereco());

        enderecoRepository.save(endereco);
        auditoriaService.registrar("Endereco", endereco.getId(), "ALTERACAO", "cliente-" + clienteId, "Endereço alterado isoladamente (RNF0034)");
        return EnderecoResponse.daEntidade(endereco);
    }

    /** RF0027 - associa mais um cartão de crédito ao cliente. */
    @Transactional
    public CartaoCreditoResponse adicionarCartao(Long clienteId, CartaoCreditoRequest request) {
        Cliente cliente = buscarClienteOuLancar(clienteId);
        boolean primeiroCartao = cartaoRepository.findAllByClienteId(clienteId).isEmpty();
        CartaoCredito cartao = construirCartao(request, cliente, primeiroCartao || request.preferencial());

        if (cartao.isPreferencial()) {
            cartaoRepository.findAllByClienteId(clienteId).forEach(c -> {
                c.setPreferencial(false);
                cartaoRepository.save(c);
            });
        }

        cartaoRepository.save(cartao);
        auditoriaService.registrar("CartaoCredito", cartao.getId(), "CRIACAO", "cliente-" + clienteId, "Cartão de crédito adicionado (RF0027)");
        return CartaoCreditoResponse.daEntidade(cartao);
    }

    public List<CartaoCreditoResponse> listarCartoes(Long clienteId) {
        buscarClienteOuLancar(clienteId);
        return cartaoRepository.findAllByClienteId(clienteId).stream().map(CartaoCreditoResponse::daEntidade).toList();
    }

    private Cliente buscarClienteOuLancar(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado."));
    }

    private Endereco construirEndereco(EnderecoRequest r, Cliente cliente) {
        return Endereco.builder()
                .cliente(cliente)
                .nome(r.nome())
                .logradouro(r.logradouro())
                .numero(r.numero())
                .complemento(r.complemento())
                .bairro(r.bairro())
                .cep(r.cep())
                .cidade(r.cidade())
                .estado(r.estado())
                .pais(r.pais())
                .observacoes(r.observacoes())
                .tipoEndereco(r.tipoEndereco() != null ? r.tipoEndereco() : TipoEndereco.AMBOS)
                .build();
    }

    /** RN0025 - a bandeira do cartão precisa estar cadastrada no domínio do sistema. */
    private CartaoCredito construirCartao(CartaoCreditoRequest r, Cliente cliente, boolean preferencial) {
        Bandeira bandeira = bandeiraRepository.findByNomeIgnoreCase(r.bandeira())
                .orElseThrow(() -> new IllegalArgumentException("Bandeira de cartão não registrada no sistema."));
        return CartaoCredito.builder()
                .cliente(cliente)
                .numero(r.numero())
                .nomeImpresso(r.nomeImpresso())
                .validade(r.validade())
                .bandeira(bandeira)
                .codigoSeguranca(r.codigoSeguranca())
                .preferencial(preferencial)
                .build();
    }
}
