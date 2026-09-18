package com.dedea.app.repository;

import com.dedea.app.dto.NgramStatProyeccion;
import com.dedea.app.model.SesionNgram;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SesionNgramRepository extends JpaRepository<SesionNgram, Integer> {

    // CAMBIO: List<Map<String, Object>> → List<NgramStatProyeccion>
    @Query(value = "SELECT sn.secuencia AS secuencia, sn.tipo AS tipo, " +
            "SUM(sn.total_intentos) AS totalIntentos, SUM(sn.errores) AS errores " +
            "FROM sesion_ngrams sn " +
            "JOIN sesiones s ON sn.sesion_id = s.id " +
            "WHERE s.identificador_temporal = :identificadorTemporal " +
            "AND s.fecha_guardado >= :fechaDesde " +
            // Agrupa bien porque `sesion_ngrams.secuencia` es as_ci en la COLUMNA (ver la
            // nota de SesionTeclaRepository): "ña" y "na" no se funden.
            "GROUP BY sn.secuencia, sn.tipo " +
            "HAVING SUM(sn.total_intentos) >= :minIntentos", nativeQuery = true)
    List<NgramStatProyeccion> findNgramStatsAgrupados(
            @Param("identificadorTemporal") String identificadorTemporal,
            @Param("fechaDesde") LocalDateTime fechaDesde,
            @Param("minIntentos") int minIntentos);
    // Estadísticas de las últimas N sesiones
    @Query(value = "SELECT sn.secuencia AS secuencia, sn.tipo AS tipo, " +
            "SUM(sn.total_intentos) AS totalIntentos, SUM(sn.errores) AS errores " +
            "FROM sesion_ngrams sn " +
            "JOIN sesiones s ON sn.sesion_id = s.id " +
            "JOIN ( " +
            "  SELECT id FROM sesiones " +
            "  WHERE identificador_temporal = :identificadorTemporal " +
            "  ORDER BY fecha_guardado DESC " +
            "  LIMIT :limite " +
            ") ultimas ON s.id = ultimas.id " +
            "WHERE s.identificador_temporal = :identificadorTemporal " +
            // Agrupa bien porque `sesion_ngrams.secuencia` es as_ci en la COLUMNA (ver la
            // nota de SesionTeclaRepository): "ña" y "na" no se funden.
            "GROUP BY sn.secuencia, sn.tipo " +
            "HAVING SUM(sn.total_intentos) >= :minIntentos", nativeQuery = true)
    List<NgramStatProyeccion> findNgramStatsUltimasSesiones(
            @Param("identificadorTemporal") String identificadorTemporal,
            @Param("limite") int limite,
            @Param("minIntentos") int minIntentos);

    @Query(value = "SELECT sn.secuencia AS secuencia, sn.tipo AS tipo, " +
            "SUM(sn.total_intentos) AS totalIntentos, SUM(sn.errores) AS errores " +
            "FROM sesion_ngrams sn " +
            "JOIN sesiones s ON sn.sesion_id = s.id " +
            "JOIN ( " +
            "  SELECT id FROM sesiones " +
            "  WHERE identificador_temporal = :identificadorTemporal " +
            "  ORDER BY fecha_guardado DESC " +
            "  LIMIT :limite OFFSET :offset " +
            ") anteriores ON s.id = anteriores.id " +
            "WHERE s.identificador_temporal = :identificadorTemporal " +
            // Agrupa bien porque `sesion_ngrams.secuencia` es as_ci en la COLUMNA (ver la
            // nota de SesionTeclaRepository): "ña" y "na" no se funden.
            "GROUP BY sn.secuencia, sn.tipo " +
            "HAVING SUM(sn.total_intentos) >= :minIntentos", nativeQuery = true)
    List<NgramStatProyeccion> findNgramStatsVentanaAnterior(
            @Param("identificadorTemporal") String identificadorTemporal,
            @Param("limite") int limite,
            @Param("offset") int offset,
            @Param("minIntentos") int minIntentos);
}

/*Records: Son un tipo especial de clase, su función es actuar como contenedor
inmutable de datos (un DTO puro).
Devuelve más datos y los pasa empaquetados directamente a través del DTO (NgramStatsProyeccion)
hacia el service

Spring Data JPA mapea automaticamente los nombres de la columna, o alias de sql a los
campos del record si los nombres coinciden exactamente
En este caso: secuencia, tipo, totalIntentos, errores
 */