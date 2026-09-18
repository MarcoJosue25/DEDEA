package com.dedea.app.util;

import com.dedea.app.model.enums.Dificultad;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/* Las reglas del clasificador de dificultad de las noticias, tal como las deja CLAUDE.md 10.2.

   El scorer está calibrado y "TERMINADO: no lo sigas ajustando". Estos tests existen para que
   eso se cumpla: fijan cada frontera y cada compuerta, así que tocar un peso o un umbral
   rompe algo acá en vez de mover la clasificación de las noticias en silencio.

   Los textos se arman de 100 caracteres a propósito: el puntaje son "puntos cada 100
   caracteres", así que cada carácter con peso suma exactamente su peso y las cuentas se leen
   directo. La letra minúscula sin tilde y el espacio no pesan nada. */
class DifficultyScorerTest {

    // --- Las cuatro bandas ------------------------------------------------------------------

    @Test
    void porDebajoDe4_8EsFacilYDesdeAhiMedio() {
        assertThat(DifficultyScorer.porcentaje(texto("12"))).isCloseTo(4.0, within(0.001));
        assertThat(DifficultyScorer.calcularDificultad(texto("12"))).isEqualTo(Dificultad.FACIL);

        assertThat(DifficultyScorer.porcentaje(texto("123"))).isCloseTo(6.0, within(0.001));
        assertThat(DifficultyScorer.calcularDificultad(texto("123"))).isEqualTo(Dificultad.MEDIO);
    }

    @Test
    void entre12Y14EsMedioDificil() {
        // 3 × '%' (2.0) + 3 dígitos (2.0) + una coma (0.8) = 12.8
        String t = texto("%%%123,");
        assertThat(DifficultyScorer.porcentaje(t)).isCloseTo(12.8, within(0.001));
        assertThat(DifficultyScorer.calcularDificultad(t)).isEqualTo(Dificultad.MEDIO_DIFICIL);
    }

    // --- Las compuertas -----------------------------------------------------------------------

    /* Puntuar alto no alcanza para DIFÍCIL: hacen falta 3 caracteres especiales. Un texto que
       llega casi solo con dígitos es una ristra de cifras que se teclea en bloque. */
    @Test
    void sinTresEspecialesNoLlegaADificilPorAltoQuePuntue() {
        String dosEspeciales = texto("%%123456");   // 4 + 12 = 16
        String tresEspeciales = texto("%%%12345");  // 6 + 10 = 16

        assertThat(DifficultyScorer.porcentaje(dosEspeciales)).isCloseTo(16.0, within(0.001));
        assertThat(DifficultyScorer.calcularDificultad(dosEspeciales)).isEqualTo(Dificultad.MEDIO_DIFICIL);
        assertThat(DifficultyScorer.calcularDificultad(tresEspeciales)).isEqualTo(Dificultad.DIFICIL);
    }

    /* Sin un solo dígito ni símbolo, un texto es FÁCIL puntúe lo que puntúe: la puntuación y
       las mayúsculas solas no hacen difícil de teclear un texto. */
    @Test
    void sinCifrasNiSimbolosEsFacilAunqueLaPuntuacionLoSuba() {
        String t = "A, ".repeat(33) + "a";   // ~33 puntos por coma y mayúscula
        assertThat(DifficultyScorer.porcentaje(t)).isGreaterThan(14.0);
        assertThat(DifficultyScorer.calcularDificultad(t)).isEqualTo(Dificultad.FACIL);
    }

    // --- La regla de los textos solo-números ------------------------------------------------

    /* Si el texto no trae más que letras, dígitos, coma, punto y `;`, y pasa de 12, los dígitos
       se recalculan a 1.5: en bloque se entra en ritmo y cuestan menos. */
    @Test
    void losDigitosEnBloqueSinSimbolosPesanMenos() {
        String t = texto("1234567");   // 7 × 2.0 = 14 → recalculado 7 × 1.5 = 10.5
        assertThat(DifficultyScorer.porcentaje(t)).isCloseTo(10.5, within(0.001));
        assertThat(DifficultyScorer.calcularDificultad(t)).isEqualTo(Dificultad.MEDIO);
    }

    /* El acantilado conocido y aceptado (CLAUDE.md 10.2): UNA comilla apaga la regla y los
       dígitos vuelven a pesar 2.0. Este test no lo aprueba, lo DOCUMENTA — si alguien suaviza
       la regla, tiene que cambiar esto a sabiendas. */
    @Test
    void unaSolaComillaApagaLaReglaDeLosDigitos() {
        String t = texto("1234567\"");   // 14 + 2 = 16, y un solo especial
        assertThat(DifficultyScorer.porcentaje(t)).isCloseTo(16.0, within(0.001));
        assertThat(DifficultyScorer.calcularDificultad(t)).isEqualTo(Dificultad.MEDIO_DIFICIL);
    }

    // --- Los pesos que salieron de medir -----------------------------------------------------

    /* La tilde pesa 0.1: los textos más cargados de tildes fueron los que el usuario tecleó
       MÁS rápido. Veinte tildes no mueven un texto de FÁCIL. */
    @Test
    void lasTildesCasiNoPesan() {
        String t = texto("1" + "á".repeat(20));   // 2 + 20 × 0.1 = 4.0
        assertThat(DifficultyScorer.porcentaje(t)).isCloseTo(4.0, within(0.001));
        assertThat(DifficultyScorer.calcularDificultad(t)).isEqualTo(Dificultad.FACIL);
    }

    // --- El scorer y el limpiador tienen que hablar de los mismos caracteres -----------------

    /* El comentario de DifficultyScorer lo advierte: "Si un carácter pasa la limpieza pero no
       está acá, llega al usuario y NO se mide". Ya pasó con `/`, `<` y `>`. Acá se prueba el
       caso general: todo símbolo que TextCleaner deja pasar tiene que sumar puntaje. */
    @Test
    @Disabled("BUG PENDIENTE (18-sep-2026): '#' y '&' entraron a TextCleaner el 29-ago (12.8) "
            + "pero no al scorer: llegan al usuario sin sumar dificultad. Quitar este @Disabled "
            + "al arreglarlo.")
    void todoSimboloQuePasaLaLimpiezaTienePeso() {
        List<String> sinPeso = new ArrayList<>();
        for (char c : "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~¡¿°€".toCharArray()) {
            String limpio = TextCleaner.limpiarTexto("hola " + c + " hola", true);
            if (limpio.indexOf(c) < 0) continue;   // el limpiador lo quita o lo convierte: no llega
            if (DifficultyScorer.porcentaje("a".repeat(99) + c) <= 0) sinPeso.add("'" + c + "'");
        }
        assertThat(sinPeso)
                .as("Símbolos que llegan al usuario sin sumar dificultad: %s", sinPeso)
                .isEmpty();
    }

    // Un texto de exactamente 100 caracteres: los que se pasan, y relleno de 'a' sin peso.
    private static String texto(String conPeso) {
        return "a".repeat(100 - conPeso.length()) + conPeso;
    }
}
