package com.dedea.app.service;

import com.dedea.app.dto.CursoStatsResponse;
import com.dedea.app.dto.ProgresoEjercicioResponse;
import com.dedea.app.dto.ResultadoCursoResponse;
import com.dedea.app.model.Ejercicio;
import com.dedea.app.model.enums.NivelCurso;

import java.math.BigDecimal;
import java.util.List;

public interface CursoStatsService {

    CursoStatsResponse obtenerStatsPorNivel(String identificadorTemporal, NivelCurso nivel);

    /* Se llama después de guardar cada sesión de un ejercicio CON nivel asignado. A
       diferencia del viejo evaluarAprobacionNivel (promedio continuo, ya retirado), esto
       es puntual por ejercicio:
       - Ejercicio normal: si supera SU umbral (propio o el default del nivel), marca
         ese nodo como completado en ProgresoEjercicioCurso.
       - TEST_NIVEL: si precisión ≥95% y WPM ≥ el umbral de aprobar el nivel, aprueba el
         nivel ENTERO de una (sin pasar por los demás ejercicios).
       - TEST_FINAL: mismo umbral que aprobar el nivel; si lo alcanza, es el único
         gatillo real de ProgresoCursoNivel.aprobado.

       Devuelve el veredicto para que la pantalla de resultados pueda mostrarlo. Antes era
       void: el servidor decidía todo esto y no se lo contaba a nadie. */
    ResultadoCursoResponse registrarProgresoEjercicio(String identificadorTemporal, Ejercicio ejercicio,
                                                     Integer wpm, BigDecimal precision,
                                                     boolean porUltimoIntento);

    // Todo el sendero de un nivel: qué nodos existen y cuáles ya se completaron.
    List<ProgresoEjercicioResponse> obtenerProgresoPorNivel(String identificadorTemporal, NivelCurso nivel);
}
