package com.dedea.app.repository;

import com.dedea.app.model.Diccionario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.query.Param;

@Repository
public interface DiccionarioRepository extends JpaRepository<Diccionario, Integer> {

    /* Escrito una sola vez: las dos consultas de ranking tienen que ordenar IGUAL, y tenerlo
       duplicado es la forma seguro de que un día dejen de coincidir. */
    String ORDEN_FRECUENCIA = "ORDER BY COALESCE(NULLIF(frecuencia_uso, 0), 2147483647) ASC";
    boolean existsByPalabra(String palabra);
    //Se usa existByPalabra para saber si tenemos esa palabra en el diccionario


    Optional<Diccionario> findByPalabra(String palabra);
    // Optional actúa como una caja fuerte, devuelve (Optional.Empty()) en lugar de null, evitando errores
    // Con findByPalabra buscamos la palabra y el programa no explota si no se encuentra

    /* EL RANKING SALE DE frecuencia_uso, NO DEL ID.

       Hasta el 27-ago-2026 esta consulta ordenaba por `id ASC` apoyada en que las
       palabras se habían sembrado en orden de frecuencia, así que el id era un ranking por
       accidente. Esa suposición murió con la pantalla de revisión manual: ahora las palabras
       entran al diccionario cuando el usuario las aprueba, y dentro de una misma tanda el
       orden de inserción es arbitrario.

       `frecuencia_uso` guarda el RANGO —1 es la palabra más usada del idioma— y llega desde
       la tabla de revisión, que a su vez lo tomó de la lista de frecuencia original.

       El COALESCE manda al final las que no tienen rango (valor 0). Sin él ordenarían
       PRIMERAS, porque 0 es el número más chico, y una palabra sin dato aparecería como si
       fuera la más común del español. */
    // Igual, pero con límite variable: lo usa "Palabras simples" para tener un pool más
    // grande del cual filtrar solo las que no llevan tildes ni letras raras.
    @Query(value = "SELECT palabra FROM diccionario " + ORDEN_FRECUENCIA + " LIMIT :limite",
            nativeQuery = true)
    List<String> findTopNPorFrecuencia(@Param("limite") int limite);

    /* Palabras que se escriben ENTERAS con un juego de letras dado — lo usa el modo de
       una mano. `patron` es una clase de caracteres de MySQL, por ejemplo
       "^[qwertasdfgzxcvb]+$". Se ordena por id (que es el ranking de frecuencia) para
       que salgan primero las palabras comunes y no rarezas del final del diccionario. */
    /* ⚠️ ORDENA POR FRECUENCIA, NO POR id.

       Ordenaba por `id ASC` apoyándose en que las palabras se habían importado en orden de
       frecuencia — el mismo atajo que ya se corrigió en findTop100PorFrecuencia (CLAUDE.md
       12.4) y que la pantalla de revisión rompió: hoy una palabra entra al diccionario
       cuando el usuario la aprueba, y dentro de una tanda el orden de inserción es
       arbitrario.

       La consecuencia era visible: "Palabras de la línea base" abría con `gasa, agallas,
       falsas, hagas` en vez de `las, sal, sala`. Afecta a todos los PALABRAS_DE_FILA y a
       MODO_UNA_MANO, que comparten esta consulta. */
    @Query(value = "SELECT palabra FROM diccionario WHERE idioma = 'es' "
            + "AND CHAR_LENGTH(palabra) >= 2 AND palabra REGEXP :patron "
            + ORDEN_FRECUENCIA + " LIMIT :limite", nativeQuery = true)
    List<String> findPorPatronDeLetras(
            @Param("patron") String patron,
            @Param("limite") int limite);
}
