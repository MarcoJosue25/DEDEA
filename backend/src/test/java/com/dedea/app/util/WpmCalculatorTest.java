package com.dedea.app.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

// La fórmula estándar: una "palabra" son 5 caracteres correctos, y se cuenta por minuto.
class WpmCalculatorTest {

    @Test
    void cuentaPalabrasDeCincoCaracteresPorMinuto() {
        assertThat(WpmCalculator.calcularWpm(250, 60)).isEqualTo(50);
        assertThat(WpmCalculator.calcularWpm(125, 30)).isEqualTo(50);
        assertThat(WpmCalculator.calcularWpm(0, 60)).isZero();
        assertThat(WpmCalculator.calcularWpm(100, 0)).as("sin duración no hay velocidad").isZero();
    }

    @Test
    void laPrecisionEsUnPorcentajeConDosDecimalesYNuncaPasaDeCien() {
        assertThat(WpmCalculator.calcularPrecision(250, 260)).isEqualByComparingTo("96.15");
        assertThat(WpmCalculator.calcularPrecision(10, 5)).isEqualByComparingTo("100.00");
        assertThat(WpmCalculator.calcularPrecision(0, 0)).isEqualByComparingTo("0.00");
    }
}
