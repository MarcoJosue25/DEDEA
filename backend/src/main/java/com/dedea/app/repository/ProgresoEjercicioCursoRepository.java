package com.dedea.app.repository;

import com.dedea.app.model.ProgresoEjercicioCurso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProgresoEjercicioCursoRepository extends JpaRepository<ProgresoEjercicioCurso, Integer> {

    Optional<ProgresoEjercicioCurso> findByIdentificadorTemporalAndEjercicioId(
            String identificadorTemporal, Integer ejercicioId);

    // Todo el progreso de un usuario en los ejercicios de UN nivel, para pintar el
    // sendero completo de una sola consulta en vez de una por nodo.
    @Query(value = "SELECT p.* FROM progreso_ejercicio_curso p "
            + "JOIN ejercicios e ON e.id = p.ejercicio_id "
            + "WHERE p.identificador_temporal = :uuid AND e.nivel = :nivel", nativeQuery = true)
    List<ProgresoEjercicioCurso> findPorNivel(@Param("uuid") String uuid, @Param("nivel") String nivel);
}
