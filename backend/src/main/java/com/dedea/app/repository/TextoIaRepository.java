package com.dedea.app.repository;

import com.dedea.app.model.TextoIa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TextoIaRepository extends JpaRepository<TextoIa, Integer> {

    // 1. Contamos cuántos textos inéditos hay para esos criterios
    @Query(value = "SELECT COUNT(t.id) FROM textos_ia t " +
            "LEFT JOIN sesiones s ON t.id = s.texto_ia_id AND s.identificador_temporal = :identificadorTemporal " +
            "WHERE t.dificultad = :dificultad " +
            "AND t.teclas_base = :teclasBase " +
            "AND s.id IS NULL", nativeQuery = true)
    long countTextoReciclableInedito(
            @Param("identificadorTemporal") String identificadorTemporal,
            @Param("dificultad") String dificultad,
            @Param("teclasBase") String teclasBase);

    // 2. Traemos uno solo saltando al índice calculado (Offset)
    @Query(value = "SELECT t.* FROM textos_ia t " +
            "LEFT JOIN sesiones s ON t.id = s.texto_ia_id AND s.identificador_temporal = :identificadorTemporal " +
            "WHERE t.dificultad = :dificultad " +
            "AND t.teclas_base = :teclasBase " +
            "AND s.id IS NULL " +
            "LIMIT 1 OFFSET :offset", nativeQuery = true)
    Optional<TextoIa> findTextoReciclableInedito(
            @Param("identificadorTemporal") String identificadorTemporal,
            @Param("dificultad") String dificultad,
            @Param("teclasBase") String teclasBase,
            @Param("offset") long offset);
}