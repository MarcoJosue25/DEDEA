package com.dedea.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

// @EnableAsync: Activa el soporte de @Async en toda la aplicación.
// Sin esto, Spring ignora silenciosamente cualquier @Async que encuentre.
// @EnableScheduling: Activa el motor de tareas programadas (@Scheduled).
@EnableAsync
@EnableScheduling
@SpringBootApplication
public class AppApplication {

    public static void main(String[] args) {
        SpringApplication.run(AppApplication.class, args);
    }
}