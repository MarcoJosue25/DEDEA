package com.dedea.app.controller;

import com.dedea.app.dto.DiccionarioFiltroRequest;
import com.dedea.app.dto.GenericResponse;
import com.dedea.app.exception.ApiException;
import com.dedea.app.service.DictionaryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.codec.Utf8;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController// Le dice a Spring que esta clase es un recepcionista web, recibe peticiones http y devuelve Jsons
@RequestMapping("/api/v1/diccionario")//Se usa para colocar la dirección base de la ruta
@RequiredArgsConstructor // Esta anotación crea un constructor automáticamente que inicializa cualquier variable puesta como final
public class DiccionarioController {

    private final DictionaryService dictionaryService; //Llamos al service

    // Misma clave que /api/v1/noticias/force-sync: ambos son endpoints de mantenimiento
    // que solo debería disparar un administrador.
    @Value("${app.admin.sync-key}")//Clave guardada en el application.yml
    private String syncKey;

    @PostMapping("/practica") //Este método solo se ejecuta con el tipo de petición Post en la ruta.
    public ResponseEntity<GenericResponse<List<String>>> generarPalabrasDePractica(
    /*@Valid: Activa las validaciones del DiccionarioFiltroRequest.*/
            @Valid @RequestBody DiccionarioFiltroRequest request) {
        //Imprimimos el mensaje en consola metiendo los datos en los corchetes
        log.info("Endpoint hit: POST /api/v1/diccionario/practica | ngram: {} | dificultad: {}",
                request.getNgram(), request.getDificultad());

        //Estamos pidiendo una lista de palabras luego de entragarle estos valores al método
        List<String> palabrasGeneradas = dictionaryService.obtenerPalabrasAleatorias(
                request.getNgram(),//Pedimos el ngram del request (que es el objeto que contiene la información que el front devolvió)
                request.getDificultad(),//Pedimos la dificultad del request. Todos estos se envían al método
                request.getLimite() // Extrae la cantidad de palabras que el usuario quiere
        );

        return ResponseEntity.ok(
                GenericResponse.success("Palabras de práctica generadas exitosamente", palabrasGeneradas)
        );
        /*ok(): Método que genera el codigo de estado http 200 (Todo perfecto) y envía el objeto
        GenericResponse.success(): Crea un objeto bien estructurado, y coloca el mensaje junto con los datos dentro de la caja
        ResponseEntity: La clase oficial de Spring Boot que representa toda la respuesta HTTP*/
    }
}
