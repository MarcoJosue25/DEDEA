package com.dedea.app.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class WpmCalculator {

    // Constructor privado para evitar instanciación
    private WpmCalculator() {
        throw new UnsupportedOperationException("Esta es una clase utilitaria y no puede ser instanciada");
    }

    /**
     * ESTA ES LA CLASE DONDE SE GENERAN LOS RESULTADOS FINALES DEL EJERCICIO
     * Calcula las Palabras por Minuto (WPM) usando el estándar internacional.
     * Fórmula: ((caracteres correctos / 5) / minutos)
     */
    public static int calcularWpm(int caracteresCorrectos, int duracionSegundos) {
        if (duracionSegundos <= 0 || caracteresCorrectos <= 0) {
            return 0;
        }

        double minutos = duracionSegundos / 60.0;
        double palabrasEstandar = caracteresCorrectos / Constants.CARACTERES_POR_PALABRA_WPM;

        // Usamos Math.round para que 64.6 WPM se guarde como 65 WPM en la BD (que es INT)
        return (int) Math.round(palabrasEstandar / minutos);
    }

    /**
     * Calcula la precisión de la escritura.
     * Fórmula: (teclas correctas / total de teclas presionadas) * 100
     */
    public static BigDecimal calcularPrecision(int teclasCorrectas, int totalTeclasPresionadas) {
        if (totalTeclasPresionadas <= 0 || teclasCorrectas <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }//Si el usuario no toca nada, se devuelve 0.00
        //set scale limita el maximo de decimales
        //roundingMode.HALF_UP significa redondea hacia arriba

        //Es la fórmula para sacar porcentajes pero nos aseguramos que sean doubles no enteros
        double precision = ((double) teclasCorrectas / totalTeclasPresionadas) * 100.0;

        // Seguro lógico: La precisión nunca puede ser mayor al 100%
        if (precision > 100.0) {
            precision = 100.0;
        }

        // Retornamos un BigDecimal con 2 decimales para que coincida exactamente
        // con el campo DECIMAL(5,2) de tu tabla SQL.
        return BigDecimal.valueOf(precision).setScale(2, RoundingMode.HALF_UP);
        //valueof es un metodo que convierte un dato primitivo a avanzado (convierte de un tipo de dato a otro)
    }
}

