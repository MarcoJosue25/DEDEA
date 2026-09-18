package com.dedea.app.repository;

import com.dedea.app.dto.TeclaStatProyeccion;
import com.dedea.app.model.SesionTecla;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SesionTeclaRepository extends JpaRepository<SesionTecla, Integer> {

    /* CAMBIO: List<Map<String, Object>> → List<TeclaStatProyeccion>
    Con este cambio se gana Seguridad de Tipos (Type Safety), y hacemos el código mantenible
    para otros desarrolladores.
    Eliminamos estos errores:
    1. Con Map, antes en el service escribíamos map.get("errores")
    Ahora solo hacemos .errores(), si nos equivocamos en una letra el ide lo marca al instante
    2. Con Map<String,Object> teníamos que forzar los Tipos de forma manual, ahora los metodos
    ya tienen el Tipo pre-configurado con el tipo de dato primitivo.
     */
    /* AGRUPAR POR TECLA DEPENDE DE LA COLACIÓN DE LA COLUMNA, no de esta consulta.

       `sesion_teclas.tecla` es `utf8mb4_0900_as_ci` —accent-sensitive, case-insensitive—
       desde el 31-ago-2026, así que un GROUP BY normal ya separa ñ de n y á de a. Antes la
       columna era `ai_ci` y cada consulta tenía que escribir su propio COLLATE; el bug que lo
       destapó fue la Ñ apareciendo "sin datos" en el mapa de calor con 238 pulsaciones
       registradas, porque se sumaban a la N.

       ⚠️ Si alguna vez se revierte la colación de la columna, TODAS las consultas de este
       repositorio y del de n-gramas vuelven a fundir acentos, en silencio y sin error. */
    @Query(value = "SELECT st.tecla AS tecla, " +
            "SUM(st.veces_presionada) AS totalIntentos, SUM(st.veces_error) AS errores " +
            "FROM sesion_teclas st " +
            "JOIN sesiones s ON st.sesion_id = s.id " +
            "WHERE s.identificador_temporal = :identificadorTemporal " +
            "AND s.fecha_guardado >= :fechaDesde " +
            "GROUP BY st.tecla " +
            "HAVING SUM(st.veces_presionada) >= :minIntentos", nativeQuery = true)
    List<TeclaStatProyeccion> findTeclaStatsAgrupados(
            @Param("identificadorTemporal") String identificadorTemporal,
            @Param("fechaDesde") LocalDateTime fechaDesde,
            @Param("minIntentos") int minIntentos);

    /* Mapa de calor del teclado. Consulta aparte de la de arriba a propósito, por dos
       razones que no se pueden mezclar:

       1. Aquella alimenta a Gemini y devuelve las 5 peores con un mínimo de 2 intentos.
          Para el mapa eso es inservible: una tecla pulsada dos veces con las dos mal
          (100%) le ganaba a la `h`, con 497 errores sobre 633 pulsaciones (78%). Como
          las cinco ganadoras salían siendo símbolos fuera de la grilla, el teclado
          entero se pintaba como "sin errores" teniendo 4484 errores registrados.
       2. El mapa usa el MISMO filtro que los promedios (CondicionesSesion.MEDIBLE):
          Noticias, IA y el Curso por niveles. Hasta el 10-sep-2026 el Curso quedaba fuera,
          con el argumento de que sus drills ("jf df kj") disparan los fallos de la fila guía;
          el usuario decidió meterlo, porque para quien empieza por el curso esos fallos SON
          su tecleo real y el mapa le salía vacío. Ejercicios Base y el Área siguen fuera.

       Sin ventana de fechas: el mapa es una foto de todo el historial. */
    @Query(value = "SELECT st.tecla AS tecla, "
            + "SUM(st.veces_presionada) AS totalIntentos, SUM(st.veces_error) AS errores "
            + "FROM sesion_teclas st "
            + "JOIN sesiones s ON st.sesion_id = s.id "
            + "WHERE s.identificador_temporal = :uuid "
            + "  AND " + CondicionesSesion.MEDIBLE + " "
            + "GROUP BY st.tecla "
            + "HAVING SUM(st.veces_presionada) >= :minIntentos", nativeQuery = true)
    List<TeclaStatProyeccion> findTeclaStatsParaMapa(
            @Param("uuid") String uuid,
            @Param("minIntentos") int minIntentos);

    /* Volumen bruto de tecleo, sin filtrar por modo: acá cuenta todo, Ejercicios Base y
       Palabras incluidos. Los promedios filtran porque las sesiones cortas y los juegos los
       deforman, pero una tecla fallada es una tecla fallada venga de donde venga.
       COALESCE porque SUM() sobre cero filas devuelve NULL, no 0. */
    @Query(value = "SELECT COALESCE(SUM(st.veces_presionada), 0) FROM sesion_teclas st "
            + "JOIN sesiones s ON st.sesion_id = s.id "
            + "WHERE s.identificador_temporal = :uuid", nativeQuery = true)
    long sumarPulsacionesTotales(@Param("uuid") String uuid);

    @Query(value = "SELECT COALESCE(SUM(st.veces_error), 0) FROM sesion_teclas st "
            + "JOIN sesiones s ON st.sesion_id = s.id "
            + "WHERE s.identificador_temporal = :uuid", nativeQuery = true)
    long sumarErroresTotales(@Param("uuid") String uuid);

    /* Teclas más falladas, escopadas a UN nivel del Curso. Consulta propia, no reutiliza
       findTeclaStatsParaMapa: aquella mezcla Noticias, IA y los tres niveles, y la
       personalización del Curso (la Lluvia de repaso) necesita solo lo del nivel. */
    @Query(value = "SELECT st.tecla AS tecla, "
            + "SUM(st.veces_presionada) AS totalIntentos, SUM(st.veces_error) AS errores "
            + "FROM sesion_teclas st "
            + "JOIN sesiones s ON st.sesion_id = s.id "
            + "JOIN ejercicios e ON e.id = s.ejercicio_id "
            + "WHERE s.identificador_temporal = :uuid "
            + "  AND s.modo_usado = 'CURSO' AND e.nivel = :nivel "
            + "GROUP BY st.tecla "
            + "HAVING SUM(st.veces_presionada) >= :minIntentos", nativeQuery = true)
    List<TeclaStatProyeccion> findTeclaStatsCursoPorNivel(
            @Param("uuid") String uuid,
            @Param("nivel") String nivel,
            @Param("minIntentos") int minIntentos);
}