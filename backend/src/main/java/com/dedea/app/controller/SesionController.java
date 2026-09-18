package com.dedea.app.controller;

import com.dedea.app.dto.GenericResponse;
import com.dedea.app.dto.SesionRequest;
import com.dedea.app.dto.SesionResponse;
import com.dedea.app.security.IdentidadResolver;
import com.dedea.app.service.SesionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Slf4j
@Validated // Activa @Pattern en @RequestHeader. Sin esto Spring ignora la validación del header.
@RestController
@RequestMapping("/api/v1/sesiones")
@RequiredArgsConstructor
public class SesionController {

    private final SesionService sesionService;
    private final IdentidadResolver identidadResolver;

    /*Endpoint: POST http://localhost:8080/api/v1/sesiones
     Recibe el JSON gigante de la partida, lo valida y lo manda al Coloso.*/
    @PostMapping // Sin ruta adicional, usa la ruta base de la clase
    public ResponseEntity<GenericResponse<SesionResponse>> guardarSesion(
            // @Pattern rechaza cualquier valor que no sea un UUID v4 estándar antes de llegar al service.
            // Formato esperado: 550e8400-e29b-41d4-a716-446655440000
            // Si el frontend manda "hola" o basura, GlobalExceptionHandler devuelve 400.
            @RequestHeader(value = "X-Identificador-Temporal", required = true)
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal,
            @Valid @RequestBody SesionRequest request) {

        // Si hay un usuario autenticado (cookie JWT válida), su identificador manda sobre el del header.
        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        // Solo logueamos un prefijo: el identificador completo es el UUID permanente de la
        // cuenta para usuarios logueados y no debería quedar entero en los logs del servidor.
        log.info("Endpoint hit: POST /api/v1/sesiones | UUID: {}...", identificadorTemporal.substring(0, 8));

        // 1. Delegamos al servicio blindado, pasándole el UUID del header explícitamente
        //Creamos una variable de tipo de dato Sesion Response y recibimos lo que fue enviado al método del service
        SesionResponse response = sesionService.guardarSesionCompletada(identificadorTemporal, request);

        // 2. Empaquetamos y devolvemos un HTTP 201 (Created)
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(GenericResponse.success("Sesión de mecanografía guardada con éxito", response));
    }
    /*status(): Método para colocar manualmente el codigoo de estado http, a diferencia de ok()
    HttpStatus.CREATED: Valor que representa el tipo de estado HTTP, representa el código 201
    Indica al front que el mensaje fue recibido y el nuevo recurso se creó en la base de datos
    .body(): Método que define lo que va dentro de la caja
    GenericResponse: El nombre de la clase molde
    success(): Método que fabrica un Json, con success true
    response: Es la variable con los datos que el service devuelve luego de guardar todo en la DB
     */
}