package com.dedea.app.security;

import com.dedea.app.model.Usuario;
import com.dedea.app.model.enums.ProveedorAuth;
import com.dedea.app.repository.UsuarioRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.SavedRequestAwareAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

// Se ejecuta una sola vez, justo después de que Google/Facebook confirman la identidad.
// Crea o recupera el Usuario, emite el JWT propio en cookie httpOnly y redirige al frontend.
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler extends SavedRequestAwareAuthenticationSuccessHandler {

    public static final String ATRIBUTO_SESION_UUID_INVITADO = "uuid_invitado_a_vincular";

    private final UsuarioRepository usuarioRepository;
    private final JwtService jwtService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${app.security.cookie-secure}")
    private boolean cookieSecure;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                         Authentication authentication) throws IOException, ServletException {

        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        String proveedorId = oauthToken.getAuthorizedClientRegistrationId(); // "google" o "facebook"
        OAuth2User oauthUser = oauthToken.getPrincipal();

        DatosProveedor datos = extraerDatos(proveedorId, oauthUser);

        Usuario usuario = usuarioRepository
                .findByProveedorAndProveedorId(datos.proveedor(), datos.id())
                .orElseGet(() -> crearUsuario(request, datos));

        String jwt = jwtService.generar(usuario);

        /* ResponseCookie y no la Cookie clásica de Servlet.

           Antes se construía un objeto `Cookie`, se le llamaba setHttpOnly, setSecure y
           setPath… y NUNCA se agregaba a la respuesta: el header se escribía a mano aparte,
           porque la API clásica no sabe poner SameSite. El resultado era correcto, pero de
           esos setters solo se leían getName, getValue y getMaxAge — los otros tres no hacían
           nada. Un objeto que parecía configuración y era medio decorativo: quien cambiara
           setPath("/api") para acotar el alcance de la cookie habría creído que cambió algo.

           ResponseCookie soporta SameSite de forma nativa, así que el atributo que obligaba a
           escribir el header a mano deja de ser una excepción y todo vive en un solo objeto
           con todos sus valores vivos. */
        ResponseCookie cookie = ResponseCookie.from(JwtAuthFilter.NOMBRE_COOKIE, jwt)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(JwtAuthFilter.DURACION_SESION)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        request.getSession().removeAttribute(ATRIBUTO_SESION_UUID_INVITADO);
        log.info("Login OAuth exitoso: usuarioId={} proveedor={}", usuario.getId(), usuario.getProveedor());

        response.sendRedirect(frontendUrl);
    }

    private Usuario crearUsuario(HttpServletRequest request, DatosProveedor datos) {
        Object uuidPrevio = request.getSession().getAttribute(ATRIBUTO_SESION_UUID_INVITADO);
        String candidato = (uuidPrevio instanceof String s && !s.isBlank()) ? s : null;

        // El UUID de invitado vive en localStorage del navegador, no de la cuenta: es el mismo
        // sin importar qué cuenta de Google/Facebook elijas. Si ya lo adoptó OTRA cuenta creada
        // antes en este mismo navegador, no podemos reusarlo (columna única) — generamos uno
        // nuevo para esta cuenta en vez de chocar contra la restricción y tirar un 500.
        boolean disponible = candidato != null && !usuarioRepository.existsByIdentificadorTemporal(candidato);
        String identificadorTemporal = disponible ? candidato : UUID.randomUUID().toString();

        Usuario nuevo = Usuario.builder()
                .email(datos.email())
                .nombre(datos.nombre())
                .avatarUrl(datos.avatarUrl())
                .proveedor(datos.proveedor())
                .proveedorId(datos.id())
                .identificadorTemporal(identificadorTemporal)
                .build();

        return usuarioRepository.save(nuevo);
    }

    private DatosProveedor extraerDatos(String proveedorId, OAuth2User oauthUser) {
        if ("google".equals(proveedorId)) {
            OidcUser oidcUser = (OidcUser) oauthUser;
            return new DatosProveedor(
                    ProveedorAuth.GOOGLE,
                    oidcUser.getSubject(),
                    oidcUser.getEmail(),
                    oidcUser.getFullName(),
                    oidcUser.getPicture());
        }
        if ("facebook".equals(proveedorId)) {
            return new DatosProveedor(
                    ProveedorAuth.FACEBOOK,
                    String.valueOf(oauthUser.getAttributes().get("id")),
                    (String) oauthUser.getAttributes().get("email"),
                    (String) oauthUser.getAttributes().get("name"),
                    null);
        }
        throw new IllegalStateException("Proveedor OAuth2 no soportado: " + proveedorId);
    }

    private record DatosProveedor(ProveedorAuth proveedor, String id, String email, String nombre, String avatarUrl) {}
}
