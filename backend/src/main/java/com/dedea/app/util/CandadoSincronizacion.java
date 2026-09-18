package com.dedea.app.util;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Impide que dos sincronizaciones de noticias corran a la vez.
 *
 * <p><b>El problema.</b> {@code force-sync}, {@code /preparar} y {@code /generar} son
 * {@code @Async}: devuelven 200 al instante y siguen trabajando en otro hilo. Dos clics
 * seguidos —o un clic y un reintento del navegador— arrancan dos tandas en paralelo que
 * recorren la misma lista de GNews y guardan las mismas noticias por duplicado. Observado en
 * vivo: una corrida de 6 noticias y después dos de 4.
 *
 * <p><b>Por qué un arrendamiento y no un simple booleano.</b> Un candado que solo se toma y se
 * suelta tiene un modo de fallo feo: si el hilo que lo tomó muere de una forma que no pasa por
 * el {@code finally}, queda tomado para siempre y NUNCA MÁS se puede sincronizar. Guardando
 * además el instante en que se tomó, un candado demasiado viejo se considera abandonado y se
 * puede volver a tomar. El sistema se recupera solo.
 *
 * <p><b>Esto COMPLEMENTA, no reemplaza, las defensas que ya existen</b> — y son las que de
 * verdad hacen el trabajo:
 * <ul>
 *   <li>El {@code RestClient} tiene {@code connectTimeout} de 15 s y {@code readTimeout} de
 *       3 min, así que ninguna llamada externa puede colgarse indefinidamente.
 *   <li>El candado vive en memoria: un reinicio del proceso lo limpia.
 *   <li>El {@code finally} de quien lo usa lo suelta en el camino normal y en el de excepción.
 * </ul>
 * El arrendamiento es la última red, para el caso que ninguna de las tres cubra.
 */
public final class CandadoSincronizacion {

    /* Cuánto puede durar como máximo una tanda antes de considerar el candado abandonado.

       NO es un tiempo esperado: una tanda normal son ~4 minutos. El número sale del PEOR caso
       real — MAX_NOTICIAS_POR_DIA (10) por el readTimeout de 3 minutos de cada llamada a
       Gemini, más las pausas de seguridad, dan unos 32 minutos. Poner 30 cortaría una corrida
       lenta pero legítima; una hora deja margen de sobra y aun así un candado trabado se cura
       solo dentro de la misma jornada. */
    private static final Duration VIDA_MAXIMA = Duration.ofHours(1);

    /* Un solo AtomicReference en vez de un booleano más una fecha: así "tomado" y "desde
       cuándo" se leen y se escriben en una sola operación atómica. Con dos campos sueltos, dos
       hilos podrían ver un estado a medio actualizar. null = libre. */
    private final AtomicReference<Instant> tomadoDesde = new AtomicReference<>(null);

    /** El nombre es para el log y para el mensaje que ve quien llama. */
    private final String nombre;

    public CandadoSincronizacion(String nombre) {
        this.nombre = nombre;
    }

    /**
     * Intenta tomar el candado.
     *
     * @return true si se tomó y hay que trabajar; false si ya hay otra corrida en curso.
     */
    public boolean tomar() {
        Instant ahora = Instant.now();
        while (true) {
            Instant actual = tomadoDesde.get();

            if (actual != null && Duration.between(actual, ahora).compareTo(VIDA_MAXIMA) < 0) {
                return false;   // tomado y todavía vigente
            }

            /* compareAndSet y no un set directo: entre el get() de arriba y esta línea, otro
               hilo pudo haberlo tomado. Si el valor cambió, el CAS falla y el bucle vuelve a
               leer el estado nuevo. Es lo que hace que dos clics simultáneos no pasen los dos. */
            if (tomadoDesde.compareAndSet(actual, ahora)) {
                return true;
            }
        }
    }

    /** ¿Está disponible ahora mismo? Solo para informar; no reserva nada. */
    public boolean libre() {
        Instant actual = tomadoDesde.get();
        return actual == null
                || Duration.between(actual, Instant.now()).compareTo(VIDA_MAXIMA) >= 0;
    }

    /** Suelta el candado. Va SIEMPRE en un {@code finally}. */
    public void soltar() {
        tomadoDesde.set(null);
    }

    /** Hace cuánto está tomado, para el mensaje de "ya hay una corrida en curso". */
    public String tiempoTomado() {
        Instant desde = tomadoDesde.get();
        if (desde == null) {
            return "no está en curso";
        }
        long minutos = Duration.between(desde, Instant.now()).toMinutes();
        return minutos < 1 ? "hace menos de un minuto" : "hace " + minutos + " min";
    }

    public String getNombre() {
        return nombre;
    }
}
