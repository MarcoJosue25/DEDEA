package com.dedea.app.service;

import com.dedea.app.dto.BusquedaPalabrasResponse;
import com.dedea.app.dto.PalabraRevisionDTO;
import com.dedea.app.dto.ResumenRevisionResponse;

import java.util.List;

public interface RevisionPalabrasService {

    /** Vuelca un archivo de palabras a la tabla de revisión, aplicando el filtro objetivo. */
    ResumenRevisionResponse importarArchivo(String nombreArchivoSeed);

    /** Manda el diccionario activo entero a PENDIENTE, para revisarlo desde cero. */
    ResumenRevisionResponse migrarDiccionarioActivo();

    /** Las siguientes N pendientes, en orden de frecuencia. */
    List<PalabraRevisionDTO> siguienteTanda(int cuantas);

    /** Guarda una tanda: las aprobadas a PREACTIVA, el resto de la tanda a NO_PERMITIDA. */
    ResumenRevisionResponse guardarTanda(List<Integer> aprobadas, List<Integer> mostradas);

    /** Todas las PREACTIVA pasan al diccionario y se vuelven visibles en la web. */
    ResumenRevisionResponse activarPreactivas();

    /** Devuelve a PENDIENTE todo lo guardado en la última tanda. */
    ResumenRevisionResponse deshacerUltimaTanda();

    /**
     * El buscador de la pantalla, con dos modos según cuántos términos se escriban.
     *
     * <p><b>Un término</b>: coincidencia por prefijo, como siempre. Sirve para barrer una
     * familia entera —{@code negr} trae negro, negros y negras— que es como se corrigen las
     * flexiones sueltas de una decisión ya tomada.
     *
     * <p><b>Dos o más</b>: coincidencia EXACTA de cada uno. No es simetría: el resultado de
     * una búsqueda por lista alimenta un botón que rechaza todo de un clic, y por prefijo ese
     * clic sería un destrozo. Medido con la lista real de 61 nombres propios, el prefijo
     * arrastraba 55 palabras de más —{@code doctor}, {@code documento}, {@code alimento},
     * {@code billete}, {@code alianza}, {@code docena}, {@code jungla}— porque {@code doc},
     * {@code ali}, {@code bill} y {@code jung} son prefijos de todas ellas.
     */
    BusquedaPalabrasResponse buscar(String texto);

    /**
     * Mueve varias palabras de cajón de un golpe, y <b>crea</b> como rechazadas las que la
     * búsqueda no encontró.
     *
     * <p>Crear las que faltan es lo que hace que el trabajo se acumule: {@code FiltroPalabra}
     * descarta todo lo que ya esté en la tabla en cualquier estado, así que una palabra
     * anotada acá no vuelve a aparecer en ninguna importación futura. Sin eso, cada archivo
     * nuevo devolvería la misma lista de nombres para volver a rechazarla a mano.
     *
     * <p>Solo se crean palabras cuando el destino es NO_PERMITIDA. Darlas de alta como
     * pre-activas sería inventar entradas de diccionario que no salieron de ningún corpus y
     * que no tienen rango de frecuencia: es otra operación, con otra decisión detrás.
     */
    ResumenRevisionResponse cambiarEstadoLote(List<Integer> ids, List<String> nuevas, String estado);

    /** Mueve una palabra a mano entre cajones (el buscador de la pantalla). */
    PalabraRevisionDTO cambiarEstado(Integer id, String nuevoEstado);

    ResumenRevisionResponse resumen();
}
