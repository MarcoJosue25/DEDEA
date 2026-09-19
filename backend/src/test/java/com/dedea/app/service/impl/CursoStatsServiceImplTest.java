package com.dedea.app.service.impl;

import com.dedea.app.dto.CursoStatsResponse;
import com.dedea.app.dto.ResultadoCursoResponse;
import com.dedea.app.model.Ejercicio;
import com.dedea.app.model.ProgresoCursoNivel;
import com.dedea.app.model.enums.NivelCurso;
import com.dedea.app.model.enums.RolEjercicioNivel;
import com.dedea.app.model.enums.TipoEjercicio;
import com.dedea.app.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/* LA PRUEBA DE NIVEL: el atajo que aprueba un nivel entero sin recorrer su sendero.
   Como se salta el nivel de una vez, tiene que exigir más precisión que terminarlo: 95%,
   decisión del usuario del 18-sep-2026 ("lo que importa es la precisión, no la
   velocidad"). Hasta entonces pedía 80%, menos que el propio Test Final. */
class CursoStatsServiceImplTest {

    private static final String UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
    private static final int ID_PRUEBA = 500;

    private final EjercicioRepository ejercicios = mock(EjercicioRepository.class);
    private CursoStatsServiceImpl servicio;

    @BeforeEach
    void preparar() {
        ProgresoCursoNivelRepository progresoNivel = mock(ProgresoCursoNivelRepository.class);
        when(progresoNivel.save(any(ProgresoCursoNivel.class))).thenAnswer(inv -> inv.getArgument(0));
        servicio = new CursoStatsServiceImpl(mock(SesionRepository.class), mock(SesionTeclaRepository.class),
                progresoNivel, mock(ProgresoEjercicioCursoRepository.class), ejercicios);
    }

    @Test
    void laPruebaDeNivelPide95DePrecision() {
        ResultadoCursoResponse casi = servicio.registrarProgresoEjercicio(
                UUID, pruebaDeNivel(), 40, new BigDecimal("94.99"), false);
        assertThat(casi.getSuperado()).as("94,99% no alcanza").isFalse();
        assertThat(casi.getNivelAprobado()).isFalse();

        ResultadoCursoResponse justo = servicio.registrarProgresoEjercicio(
                UUID, pruebaDeNivel(), 18, new BigDecimal("95.00"), false);
        assertThat(justo.getSuperado()).as("95% y 18 WPM aprueban").isTrue();
        assertThat(justo.getNivelAprobado()).isTrue();
        assertThat(justo.getNivelDesbloqueado()).isEqualTo("INTERMEDIO");
    }

    // La precisión manda, pero la velocidad del nivel se sigue pidiendo.
    @Test
    void laPruebaDeNivelSigueExigiendoLaVelocidadDelNivel() {
        ResultadoCursoResponse lento = servicio.registrarProgresoEjercicio(
                UUID, pruebaDeNivel(), 17, new BigDecimal("100.00"), false);
        assertThat(lento.getSuperado()).isFalse();
    }

    @Test
    void lasEstadisticasDelNivelAnuncianSuPruebaConLosUmbrales() {
        when(ejercicios.findFirstByNivelAndRolEnNivelAndActivoTrue(NivelCurso.BASICO, RolEjercicioNivel.TEST_NIVEL))
                .thenReturn(Optional.of(pruebaDeNivel()));

        CursoStatsResponse stats = servicio.obtenerStatsPorNivel(UUID, NivelCurso.BASICO);

        assertThat(stats.getPruebaNivelId()).isEqualTo(ID_PRUEBA);
        assertThat(stats.getPruebaNivelWpm()).isEqualTo(18);
        assertThat(stats.getPruebaNivelPrecision()).isEqualByComparingTo("95");
    }

    @Test
    void unNivelSinPruebaNoAnunciaNada() {
        CursoStatsResponse stats = servicio.obtenerStatsPorNivel(UUID, NivelCurso.INTERMEDIO);

        assertThat(stats.getPruebaNivelId()).isNull();
        assertThat(stats.getPruebaNivelWpm()).isNull();
        assertThat(stats.getPruebaNivelPrecision()).isNull();
    }

    private static Ejercicio pruebaDeNivel() {
        return Ejercicio.builder()
                .id(ID_PRUEBA)
                .titulo("Prueba de nivel: Básico")
                .tipo(TipoEjercicio.ORACIONES_TEMATICAS)
                .nivel(NivelCurso.BASICO)
                .orden(0)
                .rolEnNivel(RolEjercicioNivel.TEST_NIVEL)
                .build();
    }
}
