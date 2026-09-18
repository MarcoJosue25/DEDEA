package com.dedea.app.security;

import com.dedea.app.model.Usuario;
import com.dedea.app.repository.UsuarioRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Optional;

// Lee la cookie dedea_token (emitida tras el login OAuth) en cada request.
// Si no hay cookie, o el token es inválido/expiró, simplemente deja pasar sin autenticar:
// la app sigue funcionando en modo invitado (X-Identificador-Temporal), autenticarse es opcional.
@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    public static final String NOMBRE_COOKIE = "dedea_token";

    /* Cuánto vive la cookie de sesión. Vive acá, junto al nombre, porque el login la emite y
       el logout la borra: dos lugares que tienen que hablar de la misma cookie. */
    public static final java.time.Duration DURACION_SESION = java.time.Duration.ofDays(30);

    private final JwtService jwtService;
    private final UsuarioRepository usuarioRepository;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {

        obtenerCookie(request, NOMBRE_COOKIE)
                .flatMap(jwtService::validarYObtenerUsuarioId)
                .flatMap(usuarioRepository::findById)
                .ifPresent(usuario -> {
                    var auth = new UsernamePasswordAuthenticationToken(usuario, null, Collections.emptyList());
                    SecurityContextHolder.getContext().setAuthentication(auth);
                });

        filterChain.doFilter(request, response);
    }

    private Optional<String> obtenerCookie(HttpServletRequest request, String nombre) {
        if (request.getCookies() == null) return Optional.empty();
        for (Cookie cookie : request.getCookies()) {
            if (cookie.getName().equals(nombre)) return Optional.of(cookie.getValue());
        }
        return Optional.empty();
    }
}
