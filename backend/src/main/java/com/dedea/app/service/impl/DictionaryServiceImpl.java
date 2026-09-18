package com.dedea.app.service.impl;

import com.dedea.app.exception.ApiException;
import com.dedea.app.model.Diccionario;
import com.dedea.app.model.DiccionarioNgram;
import com.dedea.app.model.enums.Dificultad;
import com.dedea.app.model.enums.TipoNgram; // NUEVO V2: Importamos el Enum oficial para tipado seguro
import com.dedea.app.repository.DiccionarioNgramRepository;
import com.dedea.app.repository.DiccionarioRepository;
import com.dedea.app.service.DictionaryService;
import com.dedea.app.util.NgramGenerator;
import com.dedea.app.util.PalabraDifficultyScorer;
import com.dedea.app.util.TextCleaner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Collections; // NUEVO V2: Para barajar las palabras en la memoria de Java
import java.util.List;
import java.util.concurrent.ThreadLocalRandom; // NUEVO V2: Para generar offsets aleatorios rápidos y concurrentes
import java.util.stream.Collectors;

@Slf4j // Crea automáticamente un objeto "log" para imprimir mensajes en la consola
@Service /* Comunica a Spring que esta clase contiene reglas o lógica del sistema y que
           la cree cuando arranque el servidor guardándola en la memoria */
@RequiredArgsConstructor
public class DictionaryServiceImpl implements DictionaryService {

    /*Inyección de dependencias
    Final: Una vez asignado el valor, el campo ya no se puede reasignar a otro objeto
     */
    private final DiccionarioRepository diccionarioRepository;
    private final DiccionarioNgramRepository ngramRepository;

    @Override
    // Le avisa a Java que este es un método sobreescrito y no inventado,
    // así si escribimos mal el programa nos manda una alerta
    @Transactional
    // Si ocurre un error Spring hace Rollback y deshace cualquier cambio o envío a la DB
    // Si hay una excepción o algo falla deshace todo, no guarda datos a medias, es todo o nada
    public void agregarPalabra(String palabraCruda) {
        agregarPalabra(palabraCruda, null);
    }

    @Override
    @Transactional
    public void agregarPalabra(String palabraCruda, Integer rangoFrecuencia) {
        String palabraLimpia = TextCleaner.limpiarTexto(palabraCruda).toLowerCase();

        if (palabraLimpia.isEmpty() || diccionarioRepository.existsByPalabra(palabraLimpia)) {
            return;//Se corta la ejecución y es ignorada
        }

        // 1. Guardar Palabra (Padre)
        Diccionario palabraEntidad = Diccionario.builder()
                .palabra(palabraLimpia)
                .dificultad(PalabraDifficultyScorer.calcularDificultad(palabraLimpia))
                .longitud(palabraLimpia.length())
                /* El campo se llama frecuenciaUso pero lo que guarda es el RANGO: 1 es la
                   palabra mas usada del idioma, no la que mas veces aparecio. Cuanto MENOR el
                   numero, mas comun la palabra. Nadie lo leia hasta hoy —todas las filas
                   tenian 0— asi que no hay nada que migrar; queda anotado para que el nombre
                   no confunda al primero que lo consulte. */
                .frecuenciaUso(rangoFrecuencia == null ? 0 : rangoFrecuencia)
                .build();

        Diccionario guardada = diccionarioRepository.save(palabraEntidad);

        // 2. Generar y Guardar N-grams (Hijos)
        List<String> ngramsStrings = NgramGenerator.generarTodosNgrams(palabraLimpia);

        //.stream(): Separa la lista de datos para que sean revisados uno por uno
        List<DiccionarioNgram> ngramsEntidades = ngramsStrings.stream()
                //.map convierte cada elemento en un objeto
                .map(ng -> DiccionarioNgram.builder()
                        //Conecta el ngram (elemento) con su palabra padre, inyectando la llave foranea en el
                        .diccionario(guardada)
                        //Inyecta el elemento recortado dentro de la propiedad ngram del objeto
                        .ngram(ng)
                        //IF/ELSE: Si la longitud es 2, BRIGRAMA. Sino TRIGRAMA
                        .tipo(switch (ng.length()) {
                            case 1 -> TipoNgram.UNIGRAMA;
                            case 2 -> TipoNgram.BIGRAMA;
                            default -> TipoNgram.TRIGRAMA;
                        })
                        //Cierra la configuración y crea el objeto DiccionarioNgram
                        .build())
                .collect(Collectors.toList());
                //collect(..): Junta los objetos y los vuelve a poner en el List<DiccionarioNgram>
        ngramRepository.saveAll(ngramsEntidades);
        log.info("Palabra '{}' y sus {} n-grams guardados.", palabraLimpia, ngramsEntidades.size());
    }

    @Override
    // Obtener palabras aleatorias conectando con el DiccionarioNgramRepository
    // CORRECCIÓN MULTI-PASO DE RENDIMIENTO DE LA V2: Eliminación total de ORDER BY RAND()
    public List<String> obtenerPalabrasAleatorias(String ngram, String dificultad, int limite) {
        // Paso 1: Validamos estrictamente la dificultad y la convertimos a mayúsculas
        String difUpper = parseDificultad(dificultad).name();
        /*.name(): Convierte la el valor de la variable en un String simple*/

        //Consultamos la cantidad de palabras que tienen este Ngram + su dificultad
        long totalPalabras = ngramRepository.countPalabrasPorNgram(ngram, difUpper);

        if (totalPalabras == 0) {
            return Collections.emptyList();
        }


        /* Restamos el límite pedido al total para no caernos del índice de la tabla.
        Math: Clase de Java encargada de operaciones matemáticas avanzadas
        max(): Metodo que recibe dos numeros y devuelve el mayor.
        0: Ponemos este número en caso la resta salga negativa        */
        long maxOffset = Math.max(0, totalPalabras - limite);

        /*ThreadLocalRandom: Clase de Java, genera números aleatorios, mejor que random. current():
        .current(): Hace que cada petición corra en su propio hilo, cada hilo obtiene su propio generador.
        .nextLong(): Genera un long aleatorio entre el 0 y el parámetro que le pasemos */
        long randomOffset = maxOffset > 0 ? ThreadLocalRandom.current().nextLong(maxOffset + 1) : 0;

        // Paso 3: Traemos el bloque exacto de palabras saltando directo al offset indexado en MySQL sin ordenar nada
        List<String> palabras = ngramRepository.findPalabrasPorNgramConOffset(ngram, difUpper, limite, randomOffset);

        /*Collections: Clase de Java, contiene algoritmos avanzados para manipular colecciones de datos
        shuffle: Metodo que baraja los elementos dentro de la lista, alterando su orden */
        Collections.shuffle(palabras);

        return palabras;
    }
    // =================================================================================
    // MÉTODOS PRIVADOS (Fail Fast)
    // =================================================================================

    /**
     * Valida que la dificultad enviada por React sea exactamente un valor permitido.
     * Si envían "SUPERFACIL" o texto basura, rompe la petición de inmediato con un 400.
     */
    private Dificultad parseDificultad(String dif) {
        try {
            Dificultad d = Dificultad.valueOf(dif.toUpperCase());
            /* MEDIO_DIFICIL existe en el enum pero solo como RESULTADO del scorer de
               Noticias: ninguna palabra del diccionario se clasifica asi y la pantalla no lo
               ofrece. Sin este chequeo el valueOf lo aceptaba, la consulta devolvia cero y el
               usuario veia "no se encontraron palabras" — un fallo mudo en vez de un error
               claro. */
            if (d == Dificultad.MEDIO_DIFICIL) {
                throw new IllegalArgumentException("nivel no aplicable al diccionario");
            }
            return d;
        } catch (Exception e) {
            log.error("Error validando Dificultad en Diccionario: {}", dif);
            throw new ApiException("Nivel de dificultad inválido. Valores permitidos: FACIL, MEDIO, DIFICIL.");
        }
        //valueOf: Convierte un tipo de dato simple en uno complejo
    }
}
