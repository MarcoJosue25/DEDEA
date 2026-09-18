package com.dedea.app.repository;

import com.dedea.app.model.Usuario;
import com.dedea.app.model.enums.ProveedorAuth;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UsuarioRepository extends JpaRepository<Usuario, Integer> {
    Optional<Usuario> findByProveedorAndProveedorId(ProveedorAuth proveedor, String proveedorId);
    boolean existsByIdentificadorTemporal(String identificadorTemporal);
}
