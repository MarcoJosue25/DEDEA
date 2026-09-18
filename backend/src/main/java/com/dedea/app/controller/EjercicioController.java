package com.dedea.app.controller;

import com.dedea.app.dto.EjercicioContenidoResponse;
import com.dedea.app.dto.EjercicioDTO;
import com.dedea.app.dto.GenericResponse;
import com.dedea.app.dto.HistorialEjercicioResponse;
import com.dedea.app.dto.IntentoResumen;
import com.dedea.app.dto.LatidoResponse;
import com.dedea.app.dto.SesionCursoRequest;
import com.dedea.app.dto.SesionResponse;
import com.dedea.app.security.IdentidadResolver;
import com.dedea.app.service.EjercicioService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@Validated
@RestController
@RequestMapping("/api/v1/ejercicios")
@RequiredArgsConstructor
public class EjercicioController {

    private final EjercicioService ejercicioService;
    private final IdentidadResolver identidadResolver;

    // GET /api/v1/ejercicios: catálogo completo para la lista "Curso"
    @GetMapping
    public ResponseEntity<GenericResponse<List<EjercicioDTO>>> listar() {
        return ResponseEntity.ok(GenericResponse.success("Catálogo de ejercicios", ejercicioService.listarActivos()));
    }

    // GET /api/v1/ejercicios/{id}: contenido generado para esta vuelta (distinto cada vez).
    // Con ?fantasma={sesionId}, en cambio, reutiliza el texto exacto de esa sesión pasada
    // y trae sus eventos para animar el cursor fantasma (modo sombra).
    @GetMapping("/{id}")
    public ResponseEntity<GenericResponse<EjercicioContenidoResponse>> obtenerContenido(
            @PathVariable Integer id,
            @RequestParam(required = false) Integer fantasma,
            // Fantasma SIMULADO: mismo mecanismo visual que ?fantasma={sesionId}, pero sin
            // sesión real detrás — el WPM que se le pide es el ritmo que el fantasma imita.
            @RequestParam(required = false) Integer fantasmaWpm,
            /* Solo lo usa "Fundamentos de teclado": elige qué paso de la progresión
               generar, con el formato "fila:indice" (por ejemplo "central:0" = f/j).
               Si no viene, se genera el primer paso, que es el más básico. */
            @RequestParam(required = false) String grupo,
            @RequestHeader(value = "X-Identificador-Temporal", required = false)
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal) {

        if (fantasma != null) {
            String resuelto = identidadResolver.resolver(identificadorTemporal);
            return ResponseEntity.ok(GenericResponse.success("Ejercicio en modo sombra",
                    ejercicioService.generarContenidoConFantasma(id, fantasma, resuelto)));
        }
        if (fantasmaWpm != null) {
            return ResponseEntity.ok(GenericResponse.success("Ejercicio con fantasma simulado",
                    ejercicioService.generarContenidoConFantasmaSimulado(id, fantasmaWpm, grupo)));
        }
        return ResponseEntity.ok(GenericResponse.success("Ejercicio generado",
                ejercicioService.generarContenido(id, grupo, identidadResolver.resolver(identificadorTemporal))));
    }

    /* GET /api/v1/ejercicios/{id}/ultimo-intento: el quinto latido de un ejercicio de
       letras — el último intento que se ofrece tras fallar los cuatro anteriores. Se pide
       aparte porque la mayoría de las veces no hace falta.
       `data` en null significa que este ejercicio no se practica en latidos. */
    @GetMapping("/{id}/ultimo-intento")
    public ResponseEntity<GenericResponse<LatidoResponse>> obtenerUltimoIntento(
            @PathVariable Integer id,
            @RequestParam(required = false) String grupo) {
        return ResponseEntity.ok(GenericResponse.success(
                "Último intento", ejercicioService.generarUltimoIntento(id, grupo)));
    }

    // GET /api/v1/ejercicios/{id}/historial: tus mejores/peores 3 intentos de este ejercicio,
    // para el selector de modo sombra.
    @GetMapping("/{id}/historial")
    public ResponseEntity<GenericResponse<HistorialEjercicioResponse>> obtenerHistorial(
            @PathVariable Integer id,
            @RequestHeader(value = "X-Identificador-Temporal", required = true)
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal) {

        String resuelto = identidadResolver.resolver(identificadorTemporal);
        return ResponseEntity.ok(GenericResponse.success("Historial del ejercicio",
                ejercicioService.obtenerHistorial(id, resuelto)));
    }

    /* GET /api/v1/ejercicios/{id}/rival: contra quién correr en modo sombra, elegido solo.
       Existe porque la sombra no tenía forma de activarse desde la interfaz — había que
       escribir ?fantasma={sesionId} a mano en la URL. Con esto el front pregunta "¿hay
       rival?" y, si lo hay, recarga el ejercicio con ese id.
       `data` en null significa "todavía no tienes ningún intento que sirva de rival":
       es una respuesta normal, no un error. */
    @GetMapping("/{id}/rival")
    public ResponseEntity<GenericResponse<IntentoResumen>> obtenerRival(
            @PathVariable Integer id,
            @RequestHeader(value = "X-Identificador-Temporal", required = true)
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal) {

        String resuelto = identidadResolver.resolver(identificadorTemporal);
        return ResponseEntity.ok(GenericResponse.success("Rival para modo sombra",
                ejercicioService.buscarRivalSombra(id, resuelto)));
    }

    /* GET /api/v1/ejercicios/{id}/siguiente-en-curso: navegación secuencial dentro de un
       nivel del Curso. `data` en null significa "no hay siguiente" (el ejercicio no
       tiene nivel, o era el último — típicamente el Test Final): respuesta normal, no
       error. No exige identificador — no depende del usuario, solo del catálogo. */
    @GetMapping("/{id}/siguiente-en-curso")
    public ResponseEntity<GenericResponse<EjercicioDTO>> obtenerSiguienteEnCurso(@PathVariable Integer id) {
        return ResponseEntity.ok(GenericResponse.success(
                "Siguiente ejercicio de la secuencia", ejercicioService.obtenerSiguienteEnCurso(id)));
    }

    // POST /api/v1/ejercicios/{id}/sesion: guarda el resultado, incluido el log de modo sombra
    @PostMapping("/{id}/sesion")
    public ResponseEntity<GenericResponse<SesionResponse>> guardarSesion(
            @PathVariable Integer id,
            @RequestHeader(value = "X-Identificador-Temporal", required = true)
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal,
            @Valid @RequestBody SesionCursoRequest request) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        log.info("Endpoint hit: POST /api/v1/ejercicios/{}/sesion | UUID: {}...", id, identificadorTemporal.substring(0, 8));

        SesionResponse response = ejercicioService.guardarSesion(identificadorTemporal, id, request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(GenericResponse.success("Sesión de curso guardada con éxito", response));
    }
}
