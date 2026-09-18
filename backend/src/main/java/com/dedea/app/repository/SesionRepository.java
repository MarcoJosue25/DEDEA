package com.dedea.app.repository;

import com.dedea.app.dto.ProgresoTemporalProyeccion;
import com.dedea.app.dto.TeclaLentaProyeccion;
import com.dedea.app.model.Sesion;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface SesionRepository extends JpaRepository<Sesion, Integer> {

    // Spring Boot traduce esto automáticamente a:
    // SELECT * FROM sesiones WHERE identificador_temporal = ?
    List<Sesion> findByIdentificadorTemporal(String identificadorTemporal);

    // Modo sombra: mejores/peores 3 por identificador+tipo de ejercicio (Pageable define el
    // límite y el orden se arma en la llamada con Sort.by("wpm").descending()/ascending()).
    List<Sesion> findByIdentificadorTemporalAndEjercicio_Tipo(
            String identificadorTemporal, com.dedea.app.model.enums.TipoEjercicio tipo, Pageable pageable);

    // Mejores/peores 3 del mismo ejercicio EXACTO (no solo el mismo tipo) — es lo que
    // realmente ofrece el selector "practicar contra tu mejor/peor intento".
    List<Sesion> findByIdentificadorTemporalAndEjercicio_Id(
            String identificadorTemporal, Integer ejercicioId, Pageable pageable);

    // Verificación de dueño antes de entregar el fantasma: que la sesión pedida sea
    // realmente de quien la pide, no de otro usuario adivinando IDs consecutivos.
    java.util.Optional<Sesion> findByIdAndIdentificadorTemporal(Integer id, String identificadorTemporal);

    /* Elige el rival de modo sombra: la mejor sesión pasada de ESTE ejercicio que sirva
       de verdad como fantasma. No vale cualquiera —

       - texto_generado no nulo: sin el texto exacto no hay contra qué correr (las
         sesiones anteriores a modo sombra no lo guardaban);
       - con eventos registrados: son los que animan el cursor rival, y sin ellos el
         fantasma se queda clavado en el índice 0;
       - por encima de un mínimo de duración: una carrera de tres segundos no se siente
         como una carrera, y además el WPM de las sesiones muy cortas viene inflado
         porque la duración se acota a un mínimo de 1s.

       Ordena por wpm desc a propósito: el rival que vale es tu mejor intento, no el
       último. Correr contra un intento mediocre no presiona. */
    @Query(value = "SELECT s.* FROM sesiones s "
            + "WHERE s.identificador_temporal = :uuid "
            + "  AND s.ejercicio_id = :ejercicioId "
            + "  AND s.texto_generado IS NOT NULL "
            + "  AND s.duracion_segundos >= :minSegundos "
            + "  AND EXISTS (SELECT 1 FROM sesion_teclas_eventos e WHERE e.sesion_id = s.id) "
            + "ORDER BY s.wpm DESC LIMIT 1", nativeQuery = true)
    java.util.Optional<Sesion> buscarRivalParaSombra(
            @Param("uuid") String uuid,
            @Param("ejercicioId") Integer ejercicioId,
            @Param("minSegundos") int minSegundos);

    /* Las sesiones que cuentan para PROMEDIOS: Noticias, IA y el Curso por niveles sin sus
       juegos ni sus sesiones de menos de 10 s. La condición entera y su porqué viven en
       CondicionesSesion. Sus ERRORES de todas formas cuentan todos: el volumen se calcula
       aparte, sobre todas las sesiones. */
    @Query(value = "SELECT s.* FROM sesiones s WHERE s.identificador_temporal = :uuid AND "
            + CondicionesSesion.MEDIBLE, nativeQuery = true)
    List<Sesion> findMedibles(@Param("uuid") String uuid);

    /* Las que pueden marcar un RÉCORD: igual que las de arriba, pero del Curso solo el nivel
       Avanzado. Ver CondicionesSesion.PARA_MARCAS. */
    @Query(value = "SELECT s.* FROM sesiones s WHERE s.identificador_temporal = :uuid AND "
            + CondicionesSesion.PARA_MARCAS, nativeQuery = true)
    List<Sesion> findParaMarcas(@Param("uuid") String uuid);

    /* Serie temporal para el gráfico de progreso. `formato` es una máscara de
       DATE_FORMAT: '%Y-%m-%d' por día, '%x-S%v' por semana, '%Y-%m' por mes.
       Mismo filtro que los promedios, por la misma razón.

       El alias es `precisionMedia` y no `precision` porque PRECISION es palabra reservada
       de MySQL (parte de DOUBLE PRECISION) y como alias suelto rompe el parser. */
    @Query(value = "SELECT DATE_FORMAT(s.fecha_guardado, :formato) AS periodo, "
            + "ROUND(AVG(s.wpm)) AS wpm, "
            + "ROUND(AVG(s.precision_stats), 2) AS precisionMedia, "
            + "COUNT(*) AS sesiones "
            + "FROM sesiones s "
            + "WHERE s.identificador_temporal = :uuid AND " + CondicionesSesion.MEDIBLE + " "
            + "GROUP BY periodo ORDER BY periodo ASC", nativeQuery = true)
    List<ProgresoTemporalProyeccion> obtenerProgresoTemporal(
            @Param("uuid") String uuid, @Param("formato") String formato);

    /* Las sesiones de HOY, una por punto y sin agrupar: es la vista de "cómo me fue en
       cada práctica de esta tarde", con la hora en el eje.

       No lleva GROUP BY a propósito, al revés que las demás agrupaciones — acá cada
       sesión es un punto y no un promedio. Con segundos (antes solo HH:mm): dos prácticas
       en el mismo minuto compartían la etiqueta exacta del eje X, y aunque el gráfico las
       sigue dibujando en posiciones distintas (recharts no las funde en un mismo píxel),
       dos puntos vecinos con la MISMA hora mostrada, del mismo color sólido y sin borde
       que los distinga, se leían como si uno fuera copia del otro. Con segundos, cada
       práctica lleva su propia etiqueta salvo que dos casualmente caigan en el mismo
       segundo exacto — sumamente improbable para dos sesiones reales de tipeo.
       `sesiones` va fijo en 1 para respetar la misma proyección que usa el resto. */
    @Query(value = "SELECT DATE_FORMAT(s.fecha_guardado, '%H:%i:%s') AS periodo, "
            + "s.wpm AS wpm, ROUND(s.precision_stats, 2) AS precisionMedia, 1 AS sesiones "
            + "FROM sesiones s "
            + "WHERE s.identificador_temporal = :uuid AND " + CondicionesSesion.MEDIBLE + " "
            + "  AND DATE(s.fecha_guardado) = CURDATE() "
            + "ORDER BY s.fecha_guardado ASC", nativeQuery = true)
    List<ProgresoTemporalProyeccion> obtenerProgresoDeHoy(@Param("uuid") String uuid);

    /* Días distintos con actividad, del más reciente al más antiguo. Se usa para calcular
       la racha en Java, que es más legible que hacerlo en SQL.

       CUALQUIER MODO, sin el filtro de los promedios. Hasta el 10-sep-2026 solo contaban
       Noticias e IA, y alguien que practicaba solo el Curso —el usuario al que el producto
       apunta primero— perdía la racha practicando todos los días. La lista blanca existe
       porque un drill de dos segundos infla el WPM; la racha no mide rendimiento sino
       constancia, y un día con un drill es un día de práctica. Decisión del usuario. */
    @Query(value = "SELECT DISTINCT DATE(fecha_guardado) FROM sesiones "
            + "WHERE identificador_temporal = :uuid "
            + "ORDER BY 1 DESC", nativeQuery = true)
    List<java.time.LocalDate> obtenerDiasConActividad(@Param("uuid") String uuid);

    /* Teclas más LENTAS (distinto de las más falladas: puedes acertar siempre una tecla
       y aun así tardar el triple en encontrarla).

       El tiempo por pulsación no está guardado como tal: se deriva restando el instante
       de cada evento con el del anterior de la MISMA sesión (LAG). Se descartan los
       deltas fuera de 20–3000 ms: por debajo son rebotes y por encima son pausas en las
       que el usuario se fue, no la dificultad de la tecla. */
    @Query(value = "SELECT tecla AS tecla, "
            + "ROUND(AVG(delta)) AS msPromedio, COUNT(*) AS pulsaciones FROM ("
            + "  SELECT e.tecla AS tecla, "
            + "         e.tiempo_desde_inicio_ms - LAG(e.tiempo_desde_inicio_ms) "
            + "           OVER (PARTITION BY e.sesion_id ORDER BY e.orden_secuencia) AS delta "
            + "  FROM sesion_teclas_eventos e "
            + "  JOIN sesiones s ON s.id = e.sesion_id "
            + "  WHERE s.identificador_temporal = :uuid"
            + ") t "
            + "WHERE delta BETWEEN 20 AND 3000 AND CHAR_LENGTH(tecla) = 1 "
            + "GROUP BY tecla HAVING COUNT(*) >= :minPulsaciones "
            + "ORDER BY msPromedio DESC LIMIT :limite", nativeQuery = true)
    List<TeclaLentaProyeccion> obtenerTeclasMasLentas(
            @Param("uuid") String uuid,
            @Param("minPulsaciones") int minPulsaciones,
            @Param("limite") int limite);

    /* --- Analítica del Curso POR NIVEL, separada de lo de arriba: lo global mezcla
       Noticias, IA y los tres niveles, y la pantalla de estadísticas del Curso necesita un
       nivel solo, con todas sus sesiones (juegos incluidos). Un ejercicio solo cuenta acá si
       tiene nivel asignado (los de "Ejercicios Base", con nivel = null, quedan afuera). */
    @Query(value = "SELECT s.* FROM sesiones s "
            + "JOIN ejercicios e ON e.id = s.ejercicio_id "
            + "WHERE s.identificador_temporal = :uuid "
            + "  AND s.modo_usado = 'CURSO' AND e.nivel = :nivel", nativeQuery = true)
    List<Sesion> findSesionesCursoPorNivel(@Param("uuid") String uuid, @Param("nivel") String nivel);
}