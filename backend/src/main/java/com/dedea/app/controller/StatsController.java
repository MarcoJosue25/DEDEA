package com.dedea.app.controller;

import com.dedea.app.dto.GenericResponse;
import com.dedea.app.dto.ProgresoNgramResponse;
import com.dedea.app.dto.StatsResponse;
import com.dedea.app.dto.DebilidadesResponse;
import com.dedea.app.dto.ProgresoTemporalResponse;
import com.dedea.app.dto.RecordsResponse;
import com.dedea.app.dto.RivalSesionResponse;
import com.dedea.app.dto.TeclasLentasResponse;
import com.dedea.app.security.IdentidadResolver;
import com.dedea.app.service.StatsService;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Validated // Activa @Pattern en @RequestHeader. Sin esto Spring ignora la validación del header.
@RestController
@RequestMapping("/api/v1/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;
    private final IdentidadResolver identidadResolver;

    /*GET /api/v1/stats/resumen
     Endpoint para pintar el Dashboard principal rápido en React.*/
    @GetMapping("/resumen")
    public ResponseEntity<GenericResponse<StatsResponse>> obtenerResumenGlobal(
            // @Pattern rechaza cualquier valor que no sea un UUID v4 estándar antes de llegar al service.
            // Formato esperado: 550e8400-e29b-41d4-a716-446655440000
            // Si el frontend manda "hola" o basura, GlobalExceptionHandler devuelve 400.
            @RequestHeader("X-Identificador-Temporal")
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        //Llamamos al método del service con el UUID para que busque los datos de este usuario
        StatsResponse resumen = statsService.obtenerResumenGlobal(identificadorTemporal);
        return ResponseEntity.ok(GenericResponse.success("Métricas globales recuperadas", resumen));
        /*return: La orden de devolver el paquete hacia el front
        responseEntity: Caja HTTP de Spring que viaja por internet
        ok(): método de atajo con el codigo de estado 200
        GenericResponse: El molde estandar para respuestas de api
        success(): Método que fabrica el Json asegurando el campo success como True
        resumen: Variable (contiene los datos del paso anterior) se inserta dentro de data del Json*/
    }

    /*GET /api/v1/stats/debilidades
     Endpoint para cargar el mapa de calor del teclado y alimentar prompts de IA.*/
    @GetMapping("/debilidades")
    public ResponseEntity<GenericResponse<DebilidadesResponse>> obtenerDiagnosticoDebilidades(
            // @Pattern rechaza cualquier valor que no sea un UUID v4 estándar antes de llegar al service.
            // Formato esperado: 550e8400-e29b-41d4-a716-446655440000
            // Si el frontend manda "hola" o basura, GlobalExceptionHandler devuelve 400.
            @RequestHeader("X-Identificador-Temporal")
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal,
            @RequestParam(value = "enfoque", defaultValue = "GRAVES") String enfoque) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        /*Debilidades Response: Tipo de dato que contiene el mapa d debiliades
        Llamamos al método del service, con el uuid y el parámetro de enfoque (Datos PEORES o LEVES)*/
        DebilidadesResponse debilidades = statsService.obtenerDiagnosticoDebilidades(identificadorTemporal, enfoque);
        return ResponseEntity.ok(GenericResponse.success("Analítica de debilidades biométricas procesada", debilidades));
    }
    @GetMapping("/progreso-ngrams")
    public ResponseEntity<GenericResponse<ProgresoNgramResponse>> obtenerProgresoNgrams(
            @RequestHeader("X-Identificador-Temporal")
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        ProgresoNgramResponse progreso = statsService.obtenerProgresoNgrams(identificadorTemporal);
        return ResponseEntity.ok(GenericResponse.success("Progreso de ngrams calculado", progreso));
    }

    /*GET /api/v1/stats/progreso-temporal?agrupacion=dia|semana|mes
     Serie para el gráfico de evolución. La agrupación no se valida acá con @Pattern
     porque el service ya la resuelve contra un mapa cerrado y cae a "dia" si no la
     reconoce: un parámetro raro devuelve datos, no un 400.*/
    @GetMapping("/progreso-temporal")
    public ResponseEntity<GenericResponse<ProgresoTemporalResponse>> obtenerProgresoTemporal(
            @RequestHeader("X-Identificador-Temporal")
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal,
            @RequestParam(value = "agrupacion", defaultValue = "dia") String agrupacion) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        ProgresoTemporalResponse progreso =
                statsService.obtenerProgresoTemporal(identificadorTemporal, agrupacion);
        return ResponseEntity.ok(GenericResponse.success("Progreso temporal calculado", progreso));
    }

    /*GET /api/v1/stats/records
     Mejores marcas y racha de días practicando.*/
    @GetMapping("/records")
    public ResponseEntity<GenericResponse<RecordsResponse>> obtenerRecords(
            @RequestHeader("X-Identificador-Temporal")
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        RecordsResponse records = statsService.obtenerRecords(identificadorTemporal);
        return ResponseEntity.ok(GenericResponse.success("Récords y racha calculados", records));
    }

    /*GET /api/v1/stats/teclas-lentas
     Segundo modo del mapa de calor: no dónde fallas, sino dónde te demoras.*/
    @GetMapping("/teclas-lentas")
    public ResponseEntity<GenericResponse<TeclasLentasResponse>> obtenerTeclasLentas(
            @RequestHeader("X-Identificador-Temporal")
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        TeclasLentasResponse teclas = statsService.obtenerTeclasLentas(identificadorTemporal);
        return ResponseEntity.ok(GenericResponse.success("Teclas más lentas calculadas", teclas));
    }

    /* GET /api/v1/stats/mapa-teclas
       Las teclas para pintar el mapa de calor. Existe aparte de /debilidades porque aquel
       devuelve el top 5 pensado para Gemini, y con ese recorte el teclado se pintaba
       entero como "sin errores" teniendo miles registrados. */
    /* GET /api/v1/stats/rival/{sesionId}
       Convierte una sesión pasada en rival para volver a correrla. Solo Noticias e IA.
       `data` en null significa "esa sesión no sirve de rival" (no es tuya, es de otro modo
       o el contenido original ya no existe): es una respuesta normal, no un error. */
    @GetMapping("/rival/{sesionId}")
    public ResponseEntity<GenericResponse<RivalSesionResponse>> obtenerRival(
            @PathVariable Integer sesionId,
            @RequestHeader("X-Identificador-Temporal")
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        return ResponseEntity.ok(GenericResponse.success("Rival de la sesión",
                statsService.obtenerRival(sesionId, identificadorTemporal)));
    }

    @GetMapping("/mapa-teclas")
    public ResponseEntity<GenericResponse<List<DebilidadesResponse.ItemDebilidad>>> obtenerMapaDeTeclas(
            @RequestHeader("X-Identificador-Temporal")
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        return ResponseEntity.ok(GenericResponse.success("Mapa de teclas calculado",
                statsService.obtenerMapaDeTeclas(identificadorTemporal)));
    }
}