package com.dedea.app.security;

import com.dedea.app.model.Usuario;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.Optional;

@Slf4j
@Component
public class JwtService {

    private static final Duration VALIDEZ = Duration.ofDays(30);

    private final SecretKey clave;

    public JwtService(@Value("${app.jwt.secret}") String secreto) {
        // HS256 exige una clave de al menos 256 bits (32 caracteres). Falla rápido en el arranque
        // si alguien pone un secreto débil en vez de fallar en producción con un token forjable.
        this.clave = Keys.hmacShaKeyFor(secreto.getBytes(StandardCharsets.UTF_8));
    }

    public String generar(Usuario usuario) {
        Date ahora = new Date();
        Date expira = new Date(ahora.getTime() + VALIDEZ.toMillis());

        return Jwts.builder()
                .subject(String.valueOf(usuario.getId()))
                .claim("email", usuario.getEmail())
                .issuedAt(ahora)
                .expiration(expira)
                .signWith(clave)
                .compact();
    }

    public Optional<Integer> validarYObtenerUsuarioId(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(clave)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return Optional.of(Integer.valueOf(claims.getSubject()));
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Token JWT inválido o expirado: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
