package com.dedea.app.scheduler;

import com.dedea.app.service.NoticiaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class NewsScheduler {

    private final NoticiaService noticiaService;

    /*
     Se ejecuta automáticamente según la configuración del application.yml
     "0 0 9 * * *" -> Todos los días a las 9:00, hora de Lima (zone abajo).

     UNA sola corrida al día, no dos (decisión del usuario, 21-sep-2026): con
     NOTICIAS_POR_CATEGORIA fijo en 2, una segunda corrida a la tarde casi siempre
     encuentra el objetivo del día ya cumplido y no hace nada — ver la nota larga de
     objetivoDelDia en NoticiaServiceImpl. Si en el futuro se sube esa cuota y de verdad
     hace falta una segunda vuelta, se agrega una hora más acá, separada por coma.

     PATRÓN CORRECTO: @Scheduled y @Async no pueden convivir en el mismo método
     Spring usa proxies distintos para cada anotación y @Async se ignora silenciosamente
     Solución: este método solo dispara. El @Async vive en el Service
     */
    @Scheduled(cron = "${app.scheduler.cron}", zone = "America/Lima")
    public void ejecutarCargaDeNoticias() {
        log.info("Cron Job iniciado: Delegando al pool asíncrono...");
        // ejecutarFlujoCompleto() tiene @Async en NoticiaServiceImpl: prepara los
        // candidatos y genera sus resúmenes, uno atrás del otro, en un hilo separado —
        // libera este hilo del scheduler de inmediato. Antes llamaba al flujo viejo
        // (procesarNoticiasDeApiExternaAsync, sin el reparto por dificultad ni el filtro
        // de spam por lote); migrado el 21-sep-2026 al mismo flujo calibrado que ya usaban
        // los endpoints manuales /preparar y /generar.
        noticiaService.ejecutarFlujoCompleto();
        log.info("Cron Job: tarea delegada al pool. Este hilo queda libre.");
    }

    /* Revisión de imágenes que empezaron a bloquearse DESPUÉS de guardadas (ver
       NoticiaServiceImpl.revisarImagenesBloqueadas). Corre una hora antes que la carga
       del día (que arranca a las 9:00, hora de Lima) para que si algo se limpia, la
       portada de la mañana ya la muestre sin foto en vez de con el ícono roto. */
    @Scheduled(cron = "${app.scheduler.cron-imagenes}", zone = "America/Lima")
    public void ejecutarRevisionDeImagenes() {
        log.info("[IMG-CHECK] Cron Job iniciado: revisando imágenes por posible bloqueo anti-hotlinking...");
        noticiaService.revisarImagenesBloqueadas();
        /* Se cuelga del mismo cron que la revisión de imágenes en vez de crear uno nuevo:
           las dos son tareas de mantenimiento diarias y sin urgencia. */
        noticiaService.limpiarArticulosViejos();
    }
}

//@Scheduled cuenta con un solo hilo, el cual se encarga de dar la orden de ejecutar
//el método cuando el tiempo se cumple

