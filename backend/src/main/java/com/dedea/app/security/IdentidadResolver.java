package com.dedea.app.security;

import com.dedea.app.model.Usuario;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

// Punto único donde se decide qué identificador usar en las queries "por usuario":
// si hay un Usuario autenticado (cookie JWT válida), su identificadorTemporal manda
// y el header que mande el cliente se ignora. Así un usuario logueado no puede leer
// ni escribir datos de otra persona mandando un UUID ajeno en el header.
@Component
public class IdentidadResolver {

    public String resolver(String identificadorTemporalHeader) {
        return usuarioAutenticado()
                .map(Usuario::getIdentificadorTemporal)
                .orElse(identificadorTemporalHeader);
    }

    public Optional<Usuario> usuarioAutenticado() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Usuario usuario) {
            return Optional.of(usuario);
        }
        return Optional.empty();
    }
}
