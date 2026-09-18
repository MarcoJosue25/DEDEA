package com.dedea.app.controller;

import com.dedea.app.dto.GenericResponse;
import com.dedea.app.dto.TextoIaRequest;
import com.dedea.app.dto.TextoIaResponse;
import com.dedea.app.security.IdentidadResolver;
import com.dedea.app.service.IaService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Slf4j
@Validated // Activa @Pattern en @RequestHeader. Sin esto Spring ignora la validación del header.
@RestController
@RequestMapping("/api/v1/ia")
@RequiredArgsConstructor
public class IaController {

    private final IaService iaService;
    private final IdentidadResolver identidadResolver;

    @PostMapping("/generar")
    //Prometemos devolver un Formato Generic Response que dentro de Data contenga el TextoIaResponse
    // ResponseEntity<GenericResponse<TextoIaResponse>> Esto es un tipo de retorno, el molde de lo que se debe devolver
    public ResponseEntity<GenericResponse<TextoIaResponse>> generarTexto(
            //Con esta anotación verificamos que llegue el identificador temporal guardando el ID único en esa variable
            // @Pattern rechaza cualquier valor que no sea un UUID v4 estándar antes de llegar al service.
            // Formato esperado: 550e8400-e29b-41d4-a716-446655440000
            @RequestHeader(value = "X-Identificador-Temporal", required = true)
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal,//El texto del UUID se guarda acá si se pasa las 2 validaciones anteriores
        @Valid @RequestBody TextoIaRequest request) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        log.info("Endpoint hit: POST /api/v1/ia/generar | UUID: {}... | Dificultad: {}",
                identificadorTemporal.substring(0, 8), request.getDificultad());

        /*Preparamos una caja vacia de tipo TextoIaResponse
        Se pasa el UUID y los datos al service*/
        TextoIaResponse response = iaService.generarTextoPersonalizado(identificadorTemporal, request);

        // Empaquetamos el producto terminado con su sello de OK (200)
        return ResponseEntity.ok(
                GenericResponse.success("Texto generado exitosamente por IA", response)
        );
    }
}

