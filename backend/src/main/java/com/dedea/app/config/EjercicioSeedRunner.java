package com.dedea.app.config;

import com.dedea.app.service.EjercicioService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

// Siembra el catálogo base de "Curso" al arrancar. Idempotente (revisa por título),
// así que no duplica nada si el servidor se reinicia.
@Component
@RequiredArgsConstructor
public class EjercicioSeedRunner implements ApplicationRunner {

    private final EjercicioService ejercicioService;

    @Override
    public void run(ApplicationArguments args) {
        ejercicioService.sembrarCatalogoBase();
        ejercicioService.sembrarCatalogoCurso();
    }
}


/*ApplicationRunner: Interfaz de Sping con un solo metodo, (run(ApplicatioNArguments args))
Se ejecuta automátiamente una sola vez.
Al levantar el backend esta clase con el metodo run llama los dos métodos
que insertan el catálogo de ejercicios en la BD.
 */