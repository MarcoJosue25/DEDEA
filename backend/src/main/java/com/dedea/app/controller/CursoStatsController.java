package com.dedea.app.controller;

import com.dedea.app.dto.CursoStatsResponse;
import com.dedea.app.dto.GenericResponse;
import com.dedea.app.dto.ProgresoEjercicioResponse;
import com.dedea.app.model.enums.NivelCurso;
import com.dedea.app.security.IdentidadResolver;
import com.dedea.app.service.CursoStatsService;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/* Estadísticas y progreso del futuro Curso por niveles. Ruta propia, separada por
   completo de /api/v1/stats (que solo mide Noticias + IA): ninguno de los dos endpoints
   se toca. */
@Validated
@RestController
@RequestMapping("/api/v1/curso")
@RequiredArgsConstructor
public class CursoStatsController {

    private final CursoStatsService cursoStatsService;
    private final IdentidadResolver identidadResolver;

    // GET /api/v1/curso/stats/{nivel} — nivel = BASICO | INTERMEDIO | AVANZADO
    @GetMapping("/stats/{nivel}")
    public ResponseEntity<GenericResponse<CursoStatsResponse>> obtenerStatsPorNivel(
            @PathVariable NivelCurso nivel,
            @RequestHeader("X-Identificador-Temporal")
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        return ResponseEntity.ok(GenericResponse.success(
                "Estadísticas del nivel " + nivel,
                cursoStatsService.obtenerStatsPorNivel(identificadorTemporal, nivel)));
    }

    /* GET /api/v1/curso/{nivel}/progreso — el sendero completo: todos los ejercicios del
       nivel en orden, con cuáles ya se completaron. El frontend deduce el nodo "actual"
       como el primer no-completado de la lista. */
    @GetMapping("/{nivel}/progreso")
    public ResponseEntity<GenericResponse<List<ProgresoEjercicioResponse>>> obtenerProgresoPorNivel(
            @PathVariable NivelCurso nivel,
            @RequestHeader("X-Identificador-Temporal")
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        return ResponseEntity.ok(GenericResponse.success(
                "Progreso del nivel " + nivel,
                cursoStatsService.obtenerProgresoPorNivel(identificadorTemporal, nivel)));
    }
}
