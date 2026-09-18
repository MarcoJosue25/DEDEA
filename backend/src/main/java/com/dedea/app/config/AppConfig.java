package com.dedea.app.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.concurrent.Executor;

@Configuration
public class AppConfig {

    // Leemos los valores del pool desde application.yml
    // Así podemos ajustar el pool sin recompilar el proyecto
    @Value("${app.async.core-pool-size:2}")
    private int corePoolSize;

    @Value("${app.async.max-pool-size:4}")
    private int maxPoolSize;

    @Value("${app.async.queue-capacity:10}")
    private int queueCapacity;

    @Bean // Le dice a Spring que ejecute este método una vez al iniciar la aplicación
    //Este constructor hace llamadas http al exterior. Cuando se llame a la API de NewsAPI o Gemini
    //se usa este constructor para ensamblar la petición
    public RestClient.Builder restClientBuilder() {
        /* TIMEOUTS OBLIGATORIOS. Sin ellos, una peticion que el servidor nunca contesta deja el
           hilo bloqueado PARA SIEMPRE, sin excepcion y sin una linea en el log.

           Paso de verdad el 24-ago-2026: una llamada a Gemini quedo colgada mas de seis minutos
           tras el ultimo "Enviando peticion...", sin error ni respuesta. El sintoma enganya
           porque la app sigue respondiendo el resto de endpoints con normalidad — lo unico
           muerto es el hilo del executor.

           Y ahi esta el peligro real: newsTaskExecutor tiene entre 2 y 4 hilos. Con dos o tres
           cuelgues asi, la generacion de noticias deja de funcionar EN SILENCIO, sin un solo
           error que lo delate.

           El de lectura es generoso a proposito: Gemini puede tardar hasta ~2 minutos en un
           resumen largo, asi que 3 minutos deja margen sin permitir un bloqueo indefinido. */
        HttpClient clienteJdk = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();

        JdkClientHttpRequestFactory fabrica = new JdkClientHttpRequestFactory(clienteJdk);
        fabrica.setReadTimeout(Duration.ofMinutes(3));

        return RestClient.builder().requestFactory(fabrica);
    }
    /*.Builder: Clase interna estática de RestClient. Implementa el patrón de diseño Builder (Constructor)
    RestClient.builder(): Llama al método estático de la Interaz RestClient que inicialisa
    y entrega una instancia limpia y nueva del constructor*/

    // NUEVO: ObjectMapper con soporte para fechas (LocalDate, LocalDateTime)
    // Sin JavaTimeModule, Jackson no sabe serializar LocalDate y lanza InvalidDefinitionException
    // cuando intenta convertir NoticiaDTO.fechaPublicacion a JSON para el frontend.
    @Bean
    //Este método parchea el traductor para que no colapse cuando envíe fechas modernas (LocalDate)
    public ObjectMapper objectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        /*ObjectMapper: Se encarga de la bidireccionalidad de datos.
        new: Instancia un objeto crudo
        .registerModule(): Metodo de instancia de Object Mapper. instala extensiones o plugins a Jackson.
        new JavaTimeModule(): Es el plugin que el metodo anterior le instala.
        Es el parche de contabilidad que se necesita para esta conversión
        .disable(): Metodo que apaga una directiva o comportamiento por defecto que viene
        activo en el chip de Jackson
        SerializationFeature: Es un enum de Jackson. lista de configuraciones posibles de
        comportamiento cuando se están transformando objetos Java a texto Json
        .WRITE_DATES_AS_TIMESTAMPS: Constante del enum que controla como se dibuja una fecha en el Json
        Si no lo desactivas Jackson serializa las fechas como arrays [2026, 5, 22]
        al desactivarlo las serializa como "2026-05-22" (formato ISO legible) */
    }

    /* NUEVO: Pool de threads dedicado para el procesamiento asíncrono de noticias en
    lugar del pool por defecto de Spring (SimpleAsyncTaskExecutor) ya que este crea un
    hilo nuevo por cada tarea sin límite, lo que puede saturar el servidor si el scheduler
     dispara varias veces. Este pool tiene límites controlados y un nombre identificable
     en los logs.
    El nombre "newsTaskExecutor" es el que usamos en @Async("newsTaskExecutor") en
    NoticiaServiceImpl para que Spring use este pool específico.*/
    @Bean(name = "newsTaskExecutor")
    public Executor newsTaskExecutor() {
        //Devolvemos un objeto de tipo ThreadPoolTaskExecutor
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();

        // Hilos siempre activos esperando trabajo
        executor.setCorePoolSize(corePoolSize);

        // Máximo de hilos que puede crear bajo carga alta, no se activa hasta que la sala de espera esté llena
        executor.setMaxPoolSize(maxPoolSize);

        // Cola de tareas pendientes si todos los hilos están ocupados
        executor.setQueueCapacity(queueCapacity);

        // Prefijo (Etiqueta) visible en los logs: "news-task-1", "news-task-2", etc.
        // Facilita identificar qué hilo está procesando qué en la consola
        executor.setThreadNamePrefix("news-task-");

        // Espera a que las tareas en curso terminen antes de apagar el servidor, así no se corta el flujo
        //a mitad de procesar una noticia y se gusrda en el servidor
        executor.setWaitForTasksToCompleteOnShutdown(true);

        executor.initialize();
        return executor;
    }

    /*public Executor: Tipo de retorno, Executor es una Interfaz. Retorna la interfaz abstraca
    ThreadPoolTaskExecutor: Clase de Spring framework. Infraestructura que administra un pool
    de hilos reutilizables, evita el alto costo de CPU que implica destruir y crear hilos constantemente
    executor.setCorePoolSize(corePoolSize): Configura los hilos base o permanente
    executor.setMaxPoolSize(maxPoolSize): Configura el máximo de hilos que el pool tiene permitido crear
    executor.setQueueCapacity(queueCapacity): Si los hilos están ocupados las nuevas peticiones se
    forman ordenadamente en una cola estructurada en la memoria
    executor.setThreadNamePrefix("news-task-"): Spring nombra los hilos asíncronos (task-1, etc) con este
    prefijo "news-task-" cuando se vea la consola se sabrá que el hilo pertenece exclusivamente al flujo
    de las noticias, asi facilita el rastreo de bugs en los logs
    executor.setWaitForTasksToCompleteOnShutdown(true): Con true lo que se hace es esperar a que los hilos
    terminen su ejecución antes de cerrar las puertas del servidor completamente
    .initialize(): método interno que valida las propiedades anteriores y levanta las
    estructuras de datos necesarias en la RAM para que el pool empiece a operar */
}