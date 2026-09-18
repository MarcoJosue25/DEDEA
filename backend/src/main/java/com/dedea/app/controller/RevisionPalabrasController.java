package com.dedea.app.controller;

import com.dedea.app.dto.BusquedaPalabrasResponse;
import com.dedea.app.dto.CambioEstadoLoteRequest;
import com.dedea.app.dto.CambioEstadoPalabraRequest;
import com.dedea.app.dto.GenericResponse;
import com.dedea.app.dto.PalabraRevisionDTO;
import com.dedea.app.dto.ResumenRevisionResponse;
import com.dedea.app.exception.ApiException;
import jakarta.validation.Valid;
import com.dedea.app.service.RevisionPalabrasService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.codec.Utf8;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Pantalla de revisión manual del diccionario. TODO acá exige {@code X-Admin-Key}.
 *
 * <p>No hay enlace a esta sección desde ninguna parte de la web: se llega escribiendo la ruta.
 * Eso no es seguridad —una ruta oculta se descubre— y por eso además va la clave. La ruta sin
 * enlazar solo evita que un usuario normal se tropiece con ella.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/revision-palabras")
@RequiredArgsConstructor
public class RevisionPalabrasController {

    private final RevisionPalabrasService revisionService;

    @Value("${app.admin.sync-key}")
    private String syncKey;

    /* Misma comparación en tiempo constante que usa /force-sync: MessageDigest.isEqual no
       corta al primer byte distinto, así que no se puede deducir la clave midiendo cuánto
       tarda cada intento. */
    private void exigirClave(String adminKey, String endpoint) {
        if (!java.security.MessageDigest.isEqual(Utf8.encode(syncKey), Utf8.encode(adminKey))) {
            log.warn("Intento de acceso no autorizado a {}", endpoint);
            throw new ApiException("Clave de administrador incorrecta.");
        }
    }

    @GetMapping("/resumen")
    public ResponseEntity<GenericResponse<ResumenRevisionResponse>> resumen(
            @RequestHeader("X-Admin-Key") String adminKey) {
        exigirClave(adminKey, "/resumen");
        return ResponseEntity.ok(GenericResponse.success("Resumen", revisionService.resumen()));
    }

    @GetMapping("/tanda")
    public ResponseEntity<GenericResponse<List<PalabraRevisionDTO>>> tanda(
            @RequestHeader("X-Admin-Key") String adminKey,
            @RequestParam(defaultValue = "100") int cuantas) {
        exigirClave(adminKey, "/tanda");
        return ResponseEntity.ok(GenericResponse.success(
                "Siguiente tanda", revisionService.siguienteTanda(cuantas)));
    }

    /* El cuerpo lleva DOS listas y no una: las aprobadas y TODAS las que se mostraron. Sin la
       segunda, el backend no sabría qué palabras hay que rechazar — solo vería las aprobadas
       y no podría distinguir "la vi y la rechacé" de "todavía no la vi". */
    @PostMapping("/guardar")
    public ResponseEntity<GenericResponse<ResumenRevisionResponse>> guardar(
            @RequestHeader("X-Admin-Key") String adminKey,
            @RequestBody Map<String, List<Integer>> cuerpo) {
        exigirClave(adminKey, "/guardar");
        return ResponseEntity.ok(GenericResponse.success("Tanda guardada",
                revisionService.guardarTanda(cuerpo.get("aprobadas"), cuerpo.get("mostradas"))));
    }

    @PostMapping("/activar")
    public ResponseEntity<GenericResponse<ResumenRevisionResponse>> activar(
            @RequestHeader("X-Admin-Key") String adminKey) {
        exigirClave(adminKey, "/activar");
        return ResponseEntity.ok(GenericResponse.success(
                "Activación completada", revisionService.activarPreactivas()));
    }

    @PostMapping("/deshacer")
    public ResponseEntity<GenericResponse<ResumenRevisionResponse>> deshacer(
            @RequestHeader("X-Admin-Key") String adminKey) {
        exigirClave(adminKey, "/deshacer");
        return ResponseEntity.ok(GenericResponse.success(
                "Deshacer", revisionService.deshacerUltimaTanda()));
    }

    /* Un término busca por prefijo; dos o más, por coincidencia exacta de cada uno. La razón
       está en el servicio: el resultado de una búsqueda por lista alimenta un botón que
       rechaza todo de un clic, y por prefijo ese clic sería un destrozo. */
    @GetMapping("/buscar")
    public ResponseEntity<GenericResponse<BusquedaPalabrasResponse>> buscar(
            @RequestHeader("X-Admin-Key") String adminKey,
            @RequestParam String texto) {
        exigirClave(adminKey, "/buscar");
        return ResponseEntity.ok(GenericResponse.success("Resultados", revisionService.buscar(texto)));
    }

    /* Mover de a muchas, y crear como rechazadas las que la búsqueda no encontró. Va aparte de
       /estado y no como un bucle en el cliente: sesenta llamadas HTTP dejan la pantalla a medio
       actualizar si una falla por el medio, y acá o se aplica todo o no se aplica nada. */
    @PostMapping("/estado-lote")
    public ResponseEntity<GenericResponse<ResumenRevisionResponse>> cambiarEstadoLote(
            @RequestHeader("X-Admin-Key") String adminKey,
            @Valid @RequestBody CambioEstadoLoteRequest peticion) {
        exigirClave(adminKey, "/estado-lote");
        return ResponseEntity.ok(GenericResponse.success("Lote aplicado",
                revisionService.cambiarEstadoLote(
                        peticion.getIds(), peticion.getNuevas(), peticion.getEstado())));
    }

    @PostMapping("/estado")
    public ResponseEntity<GenericResponse<PalabraRevisionDTO>> cambiarEstado(
            @RequestHeader("X-Admin-Key") String adminKey,
            @Valid @RequestBody CambioEstadoPalabraRequest peticion) {
        exigirClave(adminKey, "/estado");
        return ResponseEntity.ok(GenericResponse.success("Estado cambiado",
                revisionService.cambiarEstado(peticion.getId(), peticion.getEstado())));
    }

    /* Las dos operaciones de carga. Son las únicas que mueven decenas de miles de filas, así
       que van separadas del resto y no se disparan desde la pantalla por accidente. */
    @PostMapping("/importar")
    public ResponseEntity<GenericResponse<ResumenRevisionResponse>> importar(
            @RequestHeader("X-Admin-Key") String adminKey,
            @RequestParam String archivo) {
        exigirClave(adminKey, "/importar");
        return ResponseEntity.ok(GenericResponse.success("Importación completada",
                revisionService.importarArchivo(archivo)));
    }

    @PostMapping("/migrar-diccionario")
    public ResponseEntity<GenericResponse<ResumenRevisionResponse>> migrar(
            @RequestHeader("X-Admin-Key") String adminKey) {
        exigirClave(adminKey, "/migrar-diccionario");
        return ResponseEntity.ok(GenericResponse.success("Migración completada",
                revisionService.migrarDiccionarioActivo()));
    }
}
