package com.dedea.app.service.impl;

import com.dedea.app.dto.CursoStatsResponse;
import com.dedea.app.dto.ResultadoCursoResponse;
import com.dedea.app.dto.UmbralesLatidoResponse;
import com.dedea.app.model.Ejercicio;
import com.dedea.app.model.ProgresoCursoNivel;
import com.dedea.app.model.enums.NivelCurso;
import com.dedea.app.model.enums.RolEjercicioNivel;
import com.dedea.app.model.enums.TipoEjercicio;
import com.dedea.app.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/* Las reglas con que el servidor puntúa el Curso.

   LA PRUEBA DE NIVEL: el atajo que aprueba un nivel entero sin recorrer su sendero.
   Como se salta el nivel de una vez, tiene que exigir más precisión que terminarlo: 95%,
   decisión del usuario del 18-sep-2026 ("lo que importa es la precisión, no la
   velocidad"). Hasta entonces pedía 80%, menos que el propio Test Final. */
class CursoStatsServiceImplTest {

    private static final String UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
    private static final int ID_PRUEBA = 500;
    private static final int ID_NODO_LATIDOS = 501;

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

    /* La meta que muestra el selector de niveles es la misma que exige el Test Final: sale
       de las constantes que aprueban el nivel, no de una copia en el front. */
    @Test
    void lasEstadisticasTraenLaMetaParaAprobarCadaNivel() {
        CursoStatsResponse basico = servicio.obtenerStatsPorNivel(UUID, NivelCurso.BASICO);
        CursoStatsResponse intermedio = servicio.obtenerStatsPorNivel(UUID, NivelCurso.INTERMEDIO);
        CursoStatsResponse avanzado = servicio.obtenerStatsPorNivel(UUID, NivelCurso.AVANZADO);

        assertThat(List.of(basico.getMetaWpm(), intermedio.getMetaWpm(), avanzado.getMetaWpm()))
                .containsExactly(18, 32, 45);
        assertThat(List.of(basico.getMetaPrecision(), intermedio.getMetaPrecision(), avanzado.getMetaPrecision()))
                .containsExactly(90, 92, 94);
    }

    @Test
    void unNivelSinPruebaNoAnunciaNada() {
        CursoStatsResponse stats = servicio.obtenerStatsPorNivel(UUID, NivelCurso.INTERMEDIO);

        assertThat(stats.getPruebaNivelId()).isNull();
        assertThat(stats.getPruebaNivelWpm()).isNull();
        assertThat(stats.getPruebaNivelPrecision()).isNull();
    }

    /* LOS UMBRALES DE LOS LATIDOS viajan al front con el contenido del nodo (desde el
       19-sep-2026; antes estaban escritos a mano en core/curso/latidos.ts). Tienen que ser
       exactamente los que usa el servidor al puntuar: si no, el front daría por aprobado entre
       tanda y tanda un nodo que el servidor después suspende, o al revés. */
    @Test
    void losLatidosDeUnNodoDeBasicoPiden10Wpm85PorCientoY90EnElQuintoLatido() {
        UmbralesLatidoResponse umbrales = servicio.umbralesDeLatidos(nodoDeLatidos(null, null));

        assertThat(umbrales.wpm()).isEqualTo(10);
        assertThat(umbrales.precision()).isEqualByComparingTo("85");
        assertThat(umbrales.ultimoIntentoPrecision()).isEqualByComparingTo("90");
    }

    @Test
    void losLatidosRespetanElUmbralPropioDelEjercicio() {
        UmbralesLatidoResponse umbrales = servicio.umbralesDeLatidos(nodoDeLatidos(12, new BigDecimal("88")));

        assertThat(umbrales.wpm()).isEqualTo(12);
        assertThat(umbrales.precision()).isEqualByComparingTo("88");
    }

    @Test
    void losUmbralesQueViajanSonLosMismosConQueSePuntua() {
        Ejercicio nodo = nodoDeLatidos(12, new BigDecimal("88"));
        UmbralesLatidoResponse u = servicio.umbralesDeLatidos(nodo);
        BigDecimal centesima = new BigDecimal("0.01");

        assertThat(puntuar(nodo, u.wpm(), u.precision(), false)).as("justo en el umbral aprueba").isTrue();
        assertThat(puntuar(nodo, u.wpm() - 1, u.precision(), false)).as("un WPM menos no").isFalse();
        assertThat(puntuar(nodo, u.wpm(), u.precision().subtract(centesima), false)).as("una centésima menos no").isFalse();

        assertThat(puntuar(nodo, 0, u.ultimoIntentoPrecision(), true)).as("el quinto latido, solo precisión").isTrue();
        assertThat(puntuar(nodo, 0, u.ultimoIntentoPrecision().subtract(centesima), true)).isFalse();
    }

    @Test
    void unEjercicioBaseNoTieneLatidosQueJuzgar() {
        Ejercicio base = Ejercicio.builder().id(7).titulo("Fundamentos").tipo(TipoEjercicio.LETRAS_BASICO).build();

        assertThat(servicio.umbralesDeLatidos(base)).isNull();
    }

    private boolean puntuar(Ejercicio nodo, int wpm, BigDecimal precision, boolean porUltimoIntento) {
        return servicio.registrarProgresoEjercicio(UUID, nodo, wpm, precision, porUltimoIntento).getSuperado();
    }

    private static Ejercicio nodoDeLatidos(Integer umbralWpmPropio, BigDecimal umbralPrecisionPropia) {
        return Ejercicio.builder()
                .id(ID_NODO_LATIDOS)
                .titulo("Fundamentos: f j")
                .tipo(TipoEjercicio.LETRAS_BASICO)
                .nivel(NivelCurso.BASICO)
                .orden(1)
                .umbralWpmPropio(umbralWpmPropio)
                .umbralPrecisionPropia(umbralPrecisionPropia)
                .build();
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
