package com.dedea.app.controller;

import com.dedea.app.dto.GenericResponse;
import com.dedea.app.dto.NoticiaDTO;
import com.dedea.app.exception.ApiException;
import com.dedea.app.security.IdentidadResolver;
import com.dedea.app.service.NoticiaService;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.codec.Utf8;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@Validated // Activa @Pattern en @RequestHeader. Sin esto Spring ignora la validación del header.
@RestController
@RequestMapping("/api/v1/noticias")
@RequiredArgsConstructor
public class NoticiaController {

    private final NoticiaService noticiaService;
    private final IdentidadResolver identidadResolver;

    // La clave secreta vive en application.yml, nunca en el código fuente.
    // En application.yml agrega: app.admin.sync-key=tu-clave-secreta-aqui
    @Value("${app.admin.sync-key}")
    private String syncKey;

    // GET /api/v1/noticias
    @GetMapping
    public ResponseEntity<GenericResponse<List<NoticiaDTO>>> obtenerNoticias() {
        log.info("Endpoint hit: GET /api/v1/noticias (Noticias del día)");

        List<NoticiaDTO> noticias = noticiaService.obtenerNoticiasDelDia();
        return ResponseEntity.ok(GenericResponse.success("Noticias de hoy obtenidas con éxito", noticias));
    }

    // GET /api/v1/noticias/15
    @GetMapping("/{id}")
    public ResponseEntity<GenericResponse<NoticiaDTO>> obtenerNoticiaPorId(@PathVariable Integer id) {
        log.info("Endpoint hit: GET /api/v1/noticias/{}", id);

        NoticiaDTO noticia = noticiaService.obtenerPorId(id);
        return ResponseEntity.ok(GenericResponse.success("Noticia encontrada", noticia));
    }

    // GET /api/v1/noticias/aleatoria?categoria=tecnologia&dificultad=MEDIO
    @GetMapping("/aleatoria")
    public ResponseEntity<GenericResponse<NoticiaDTO>> obtenerAleatoriaInedita(
            // @Pattern rechaza cualquier valor que no sea un UUID v4 estándar antes de llegar al service.
            // Formato esperado: 550e8400-e29b-41d4-a716-446655440000
            // Si el frontend manda "hola" o basura, GlobalExceptionHandler devuelve 400.
            @RequestHeader(value = "X-Identificador-Temporal", required = true)
            @Pattern(
                    regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                    message = "El identificador temporal debe ser un UUID válido"
            ) String identificadorTemporal,
            @RequestParam(required = false) String categoria,
            @RequestParam(required = false) String dificultad) {

        identificadorTemporal = identidadResolver.resolver(identificadorTemporal);
        log.info("Endpoint hit: GET /api/v1/noticias/aleatoria | UUID: {}...", identificadorTemporal.substring(0, 8));

        NoticiaDTO noticia = noticiaService.obtenerNoticiaAleatoriaInedita(identificadorTemporal, categoria, dificultad);
        return ResponseEntity.ok(GenericResponse.success("Noticia aleatoria generada", noticia));
    }

    // POST /api/v1/noticias/force-sync
    // PROTEGIDO: Requiere el header X-Admin-Key con la clave configurada en application.yml
    // Uso en Postman cambiándolo a método POST
    @PostMapping("/force-sync")
    public ResponseEntity<GenericResponse<String>> forzarSincronizacion(
            @RequestHeader(value = "X-Admin-Key", required = true) String adminKey) {

        // Comparamos la clave recibida contra la clave real del servidor.
        // MessageDigest.isEqual compara en tiempo constante (no corta al primer byte distinto),
        // así un atacante no puede deducir la clave midiendo cuánto tarda cada intento.
        // Si no coincide lanzamos ApiException → GlobalExceptionHandler devuelve 400
        if (!java.security.MessageDigest.isEqual(Utf8.encode(syncKey), Utf8.encode(adminKey))) {
            log.warn("Intento de acceso no autorizado a /force-sync");
            throw new ApiException("Clave de administrador incorrecta.");
        }

        log.info("Sincronización manual autorizada y disparada.");
        /* Se avisa ANTES de disparar. Sin esto la respuesta decía "iniciada" aunque el
           candado descartara la llamada, porque el método es @Async y vuelve al instante. */
        String enCurso = noticiaService.sincronizacionEnCurso();
        if (enCurso != null) {
            return ResponseEntity.ok(GenericResponse.success(
                    "Ya hay una sincronización en curso (" + enCurso + "). No se disparó otra.", null));
        }

        noticiaService.procesarNoticiasDeApiExternaAsync();
        return ResponseEntity.ok(GenericResponse.success("Sincronización iniciada en segundo plano.", null));
    }

    /* POST /api/v1/noticias/preparar
       PASO 1 del flujo en dos pasos.

       Junta articulos de GNews, los scrapea con Readability, descarta lo que no es noticia
       (formatos recurrentes por heuristica + un filtro de spam que cuesta UNA llamada a
       Gemini) y empareja cada candidato con el nivel que su contenido puede sostener.

       No guarda nada: deja el resultado en el log y los candidatos en memoria. Esta separado
       de la generacion justamente para poder revisar que se junto antes de gastar una
       llamada por cada resumen. */
    @PostMapping("/preparar")
    public ResponseEntity<GenericResponse<String>> preparar(
            @RequestHeader(value = "X-Admin-Key", required = true) String adminKey) {

        if (!java.security.MessageDigest.isEqual(Utf8.encode(syncKey), Utf8.encode(adminKey))) {
            log.warn("Intento de acceso no autorizado a /preparar");
            throw new ApiException("Clave de administrador incorrecta.");
        }

        log.info("Preparacion de candidatos autorizada y disparada.");
        /* Se avisa ANTES de disparar. Sin esto la respuesta decía "iniciada" aunque el
           candado descartara la llamada, porque el método es @Async y vuelve al instante. */
        String enCurso = noticiaService.sincronizacionEnCurso();
        if (enCurso != null) {
            return ResponseEntity.ok(GenericResponse.success(
                    "Ya hay una sincronización en curso (" + enCurso + "). No se disparó otra.", null));
        }

        noticiaService.prepararCandidatos();
        return ResponseEntity.ok(GenericResponse.success(
                "Preparacion iniciada en segundo plano. El resultado sale en el log.", null));
    }

    /* POST /api/v1/noticias/generar
       PASO 2: pide a Gemini el resumen de cada candidato preparado y los guarda.
       Una llamada por noticia. Requiere haber corrido /preparar antes. */
    @PostMapping("/generar")
    public ResponseEntity<GenericResponse<String>> generar(
            @RequestHeader(value = "X-Admin-Key", required = true) String adminKey) {

        if (!java.security.MessageDigest.isEqual(Utf8.encode(syncKey), Utf8.encode(adminKey))) {
            log.warn("Intento de acceso no autorizado a /generar");
            throw new ApiException("Clave de administrador incorrecta.");
        }

        log.info("Generacion de resumenes autorizada y disparada.");
        /* Se avisa ANTES de disparar. Sin esto la respuesta decía "iniciada" aunque el
           candado descartara la llamada, porque el método es @Async y vuelve al instante. */
        String enCurso = noticiaService.sincronizacionEnCurso();
        if (enCurso != null) {
            return ResponseEntity.ok(GenericResponse.success(
                    "Ya hay una sincronización en curso (" + enCurso + "). No se disparó otra.", null));
        }

        noticiaService.generarDesdeCandidatos();
        return ResponseEntity.ok(GenericResponse.success(
                "Generacion iniciada en segundo plano. El resultado sale en el log.", null));
    }

    /* POST /api/v1/noticias/sondear?porCategoria=2
       DIAGNÓSTICO, no producto. Trae artículos, los scrapea y vuelca su perfil al log.

       NO llama a Gemini y NO guarda nada, así que se puede correr las veces que haga falta
       sin tocar la cuota diaria de 20 llamadas. Sirve para calibrar los umbrales de
       PerfilArticulo mirando artículos reales.

       Va protegido igual que force-sync: no persiste nada, pero sí consume peticiones a
       GNews, que tiene su propio límite. */
    @PostMapping("/sondear")
    public ResponseEntity<GenericResponse<String>> sondear(
            @RequestHeader(value = "X-Admin-Key", required = true) String adminKey,
            @RequestParam(defaultValue = "2") int porCategoria) {

        if (!java.security.MessageDigest.isEqual(Utf8.encode(syncKey), Utf8.encode(adminKey))) {
            log.warn("Intento de acceso no autorizado a /sondear");
            throw new ApiException("Clave de administrador incorrecta.");
        }
        if (porCategoria < 1 || porCategoria > 10) {
            throw new ApiException("porCategoria debe estar entre 1 y 10.");
        }

        log.info("Sondeo de artículos autorizado y disparado ({} por categoría).", porCategoria);
        noticiaService.sondearArticulos(porCategoria);
        return ResponseEntity.ok(GenericResponse.success(
                "Sondeo iniciado en segundo plano. El resultado sale en el log.", null));
    }
}