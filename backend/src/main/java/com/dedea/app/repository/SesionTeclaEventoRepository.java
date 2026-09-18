package com.dedea.app.repository;

import com.dedea.app.model.SesionTeclaEvento;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SesionTeclaEventoRepository extends JpaRepository<SesionTeclaEvento, Integer> {
    List<SesionTeclaEvento> findBySesionIdOrderByOrdenSecuenciaAsc(Integer sesionId);
}
