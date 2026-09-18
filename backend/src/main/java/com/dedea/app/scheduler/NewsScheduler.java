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
     "0 0 8,20 * * *" -> Todos los días a las 8:00 y 20:00 (8 PM)

     PATRÓN CORRECTO: @Scheduled y @Async no pueden convivir en el mismo método
     Spring usa proxies distintos para cada anotación y @Async se ignora silenciosamente
     Solución: este método solo dispara. El @Async vive en el Service
     */
    @Scheduled(cron = "${app.scheduler.cron}")
    public void ejecutarCargaDeNoticias() {
        log.info("Cron Job iniciado: Delegando al pool asíncrono...");
        // procesarNoticiasDeApiExternaAsync() tiene @Async en NoticiaServiceImpl,
        // lo que mueve el trabajo pesado (scraping + Gemini + Thread.sleep)
        // a un hilo separado y libera este hilo del scheduler inmediatamente.
        noticiaService.procesarNoticiasDeApiExternaAsync();
        log.info("Cron Job: tarea delegada al pool. Este hilo queda libre.");
    }

    /* Revisión de imágenes que empezaron a bloquearse DESPUÉS de guardadas (ver
       NoticiaServiceImpl.revisarImagenesBloqueadas). Corre antes que la carga del día
       (que arranca a las 8:00) para que si algo se limpia, la portada de la mañana ya
       la muestre sin foto en vez de con el ícono roto. */
    @Scheduled(cron = "${app.scheduler.cron-imagenes}")
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

