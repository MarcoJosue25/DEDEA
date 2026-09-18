package com.dedea.app.controller;

import com.dedea.app.dto.GenericResponse;
import com.dedea.app.dto.UsuarioResponse;
import com.dedea.app.dto.VincularUuidRequest;
import com.dedea.app.model.Usuario;
import com.dedea.app.security.IdentidadResolver;
import com.dedea.app.security.JwtAuthFilter;
import com.dedea.app.security.OAuth2LoginSuccessHandler;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final IdentidadResolver identidadResolver;

    @Value("${app.security.cookie-secure}")//La propiedad se guarda en el application.yml
    private boolean cookieSecure; //Al ser llamado devuelve si es True o False

    // GET /api/v1/auth/me: el frontend lo llama al cargar para saber si hay una sesión activa.
    @GetMapping("/me")
    public ResponseEntity<GenericResponse<UsuarioResponse>> obtenerUsuarioActual() {
        //Si el optional tiene valor .map() lo convierte en un UsuarioResponse con sus datos, sino se llama al método invitado()
        UsuarioResponse respuesta = identidadResolver.usuarioAutenticado()
                .map(u -> new UsuarioResponse(true, u.getId(), u.getEmail(), u.getNombre(), u.getAvatarUrl()))
                .orElseGet(UsuarioResponse::invitado);
        return ResponseEntity.ok(GenericResponse.success("Estado de autenticación", respuesta));
    }

    // POST /api/v1/auth/logout: borra la cookie del JWT. El UUID de invitado en localStorage
    // no se toca acá; eso lo maneja el frontend para volver a modo invitado sin perder la sesión del navegador.
    @PostMapping("/logout")
    public ResponseEntity<GenericResponse<Void>> logout(HttpServletResponse response) {
        /* Mismo mecanismo que la emisión (ver OAuth2LoginSuccessHandler): un ResponseCookie
           con todos los atributos vivos. Para borrar, maxAge en cero.

           Los atributos tienen que coincidir con los de la cookie original —mismo nombre,
           mismo path— o el navegador la trata como otra cookie distinta y la vieja sobrevive. */
        ResponseCookie borrar = ResponseCookie.from(JwtAuthFilter.NOMBRE_COOKIE, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, borrar.toString());
        return ResponseEntity.ok(GenericResponse.success("Sesión cerrada", null));
        /*HttpServletResponse: Al declarar un parámetro con este tipo de dato, Spring te da acceso
        de bajo nivel para manipular encabezados, ResponseEntity no te deja armarlos de forma cómoda
        .addHeader("encabezado","valor"): Agrega un encabezado HTTP a la respuesta
        .ok(): Fija el código HTTP en 200(OK) Coloca el Genérico como argumento
         */
    }

    // POST /api/v1/auth/vincular-uuid-invitado: el frontend lo llama justo antes de redirigir
    // a /oauth2/authorization/google (o facebook), para que si es su primer login, la cuenta
    // nueva adopte el UUID de invitado y no pierda el historial que ya tenía en ese navegador.
    @PostMapping("/vincular-uuid-invitado")
    public ResponseEntity<GenericResponse<Void>> vincularUuidInvitado(
            @Valid @RequestBody VincularUuidRequest peticion, HttpServletRequest request) {
        /* La comprobación del formato vive ahora en VincularUuidRequest, no acá.

           Antes se validaba a mano con un matches() y, si no cumplía, el método NO guardaba
           nada pero igual respondía "UUID registrado para vincular". O sea que un uuid mal
           formado se aceptaba en silencio y el usuario perdía su historial al iniciar sesión
           sin que nada avisara. Con @Valid, Spring corta antes y devuelve un 400 diciendo
           cuál es el campo que falla. */
        request.getSession().setAttribute(
                OAuth2LoginSuccessHandler.ATRIBUTO_SESION_UUID_INVITADO, peticion.getUuid());
        return ResponseEntity.ok(GenericResponse.success("UUID registrado para vincular", null));
    }
    /*.matches(regex): Revisa que el texto coincida con el patrón
     .getSession(): Obtiene o crea la sesion HTTP asociada al navegador
     .setAttribute(clave, valor): Guarda un dato (Clave, Valor) dentro de la sesión.

     */


}

