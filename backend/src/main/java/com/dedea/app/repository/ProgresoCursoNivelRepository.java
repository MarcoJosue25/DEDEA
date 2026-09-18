package com.dedea.app.repository;

import com.dedea.app.model.ProgresoCursoNivel;
import com.dedea.app.model.enums.NivelCurso;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProgresoCursoNivelRepository extends JpaRepository<ProgresoCursoNivel, Integer> {

    Optional<ProgresoCursoNivel> findByIdentificadorTemporalAndNivel(String identificadorTemporal, NivelCurso nivel);

    List<ProgresoCursoNivel> findByIdentificadorTemporal(String identificadorTemporal);
}
