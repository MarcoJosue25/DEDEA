package com.dedea.app.service.impl;

import com.dedea.app.dto.SesionRequest;
import com.dedea.app.dto.TeclaStatsRequest;
import com.dedea.app.exception.ApiException;
import com.dedea.app.mapper.EntityMapper;
import com.dedea.app.model.Sesion;
import com.dedea.app.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/* EL SERVIDOR RECALCULA EL WPM (CLAUDE.md 13.1). Hasta el 29-ago-2026 se guardaba el número
   que mandaba el navegador, así que desde la consola se podía registrar un 900 y quedaba en
   el historial y en los récords.

   La regla vigente, con su porqué medido: en NOTICIAS e IA manda el recálculo; en el resto
   se conserva el número del cliente, porque ahí cliente y servidor miden cosas distintas. */
class SesionServiceImplTest {

    private static final String UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

    private final AtomicReference<Sesion> guardada = new AtomicReference<>();
    private SesionServiceImpl servicio;

    @BeforeEach
    void preparar() {
        SesionRepository sesiones = mock(SesionRepository.class);
        when(sesiones.save(any(Sesion.class))).thenAnswer(inv -> {
            Sesion s = inv.getArgument(0);
            s.setId(1);
            guardada.set(s);
            return s;
        });
        servicio = new SesionServiceImpl(sesiones, mock(SesionNgramRepository.class),
                mock(SesionTeclaRepository.class), mock(SesionProgresoRepository.class),
                mock(SesionTeclaEventoRepository.class), mock(NoticiaRepository.class),
                mock(TextoIaRepository.class), new EntityMapper());
    }

    @Test
    void enNoticiasSeGuardaElWpmRecalculadoYNoElDelCliente() {
        // 250 correctas en 60 s son 50 palabras de 5 caracteres por minuto.
        servicio.guardarSesionCompletada(UUID, pedido("NOTICIAS", 900, 60, teclas(260, 250)));

        assertThat(guardada.get().getWpm()).isEqualTo(50);
        assertThat(guardada.get().getPrecision()).isEqualByComparingTo("96.15");
    }

    @Test
    void enIaTambienMandaElServidor() {
        servicio.guardarSesionCompletada(UUID, pedido("IA", 45, 30, teclas(125, 125)));

        assertThat(guardada.get().getWpm()).isEqualTo(50);
        assertThat(guardada.get().getPrecision()).isEqualByComparingTo("100.00");
    }

    /* Fuera de Noticias e IA se conserva el número del cliente A PROPÓSITO: en los drills que
       se reinician las pulsaciones acumuladas no corresponden al intento final (medido: 16 de
       295 sesiones). Este test fija esa regla; si algún día cambia, que sea a sabiendas. */
    @Test
    void enLosDemasModosSeConservaElNumeroDelCliente() {
        servicio.guardarSesionCompletada(UUID, pedido("LIBRE", 72, 60, teclas(260, 250)));

        assertThat(guardada.get().getWpm()).isEqualTo(72);
    }

    /* Sin pulsaciones no hay de dónde recalcular. Hasta el 18-sep-2026 eso dejaba pasar el
       número del cliente: bastaba con no mandar `teclas` para registrar un 900. En la app
       nunca pasa (Noticias e IA guardan al terminar el texto), así que se rechaza. */
    @Test
    void unaSesionDeNoticiasOIaSinPulsacionesSeRechaza() {
        for (SesionRequest pedido : List.of(
                pedido("NOTICIAS", 900, 60, null),
                pedido("IA", 900, 60, List.of()))) {
            guardada.set(null);

            assertThatThrownBy(() -> servicio.guardarSesionCompletada(UUID, pedido))
                    .as("modo %s sin pulsaciones", pedido.getModoUsado())
                    .isInstanceOf(ApiException.class);
            assertThat(guardada.get()).as("no se tiene que guardar nada").isNull();
        }
    }

    // --- Ayudas ---------------------------------------------------------------------------

    private static SesionRequest pedido(String modo, int wpm, int segundos, List<TeclaStatsRequest> teclas) {
        return SesionRequest.builder()
                .modoUsado(modo)
                .dificultad("MEDIO")
                .wpm(wpm)
                .precision(new BigDecimal("99.00"))
                .segundos(segundos)
                .teclas(teclas)
                .build();
    }

    private static List<TeclaStatsRequest> teclas(int presionadas, int correctas) {
        return List.of(TeclaStatsRequest.builder()
                .tecla("a")
                .vecesPresionada(presionadas)
                .vecesCorrecta(correctas)
                .vecesError(presionadas - correctas)
                .tiempoTotalMs(0L)
                .build());
    }
}
