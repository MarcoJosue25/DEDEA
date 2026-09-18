package com.dedea.app.exception;

import com.dedea.app.dto.GenericResponse;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.HashMap;
import java.util.Map;

// Actúa como escudo perimetral unificado para todos los @RestController del sistema.
// Atrapa cualquier excepción lanzada en las capas inferiores (Service/Repository/Controller) antes de que
// salga al cliente(React), transformando el fallo en un payload estructurado de GenericResponse limpio
@RestControllerAdvice //Interceptor global
@Slf4j // Crea automáticamente el objeto "log" para escribir en la consola y el archivo dedea.log

public class GlobalExceptionHandler {

    //Pone este método como el encargado de atrapar excepciones de este tipo.
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<GenericResponse<Void>> handleResourceNotFoundException(ResourceNotFoundException ex) {
        /*ResponseEntity (Es el tipo de retorno) es una clase nativa de Spring, representa la respuesta Http completa y controla lo que sale del servidor
        <Void> Usamos void porque en los casos de error no hay datos reales que devolver.
        ResourceNotFoundException ex: Spring atrapa el error y lo pasa a la variable ex*/
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(GenericResponse.error(ex.getMessage()));
      /*Return: Devolver el resultado con el código de no encontrado (404)
        .body(...): Devolvemos el objeto Generic response completo, mas el mensaje de error
         HttpStatus.NOT_FOUND: Es un enum (Constante) dentro de la clase HttpStatus, es una forma
         elegante y legible de escribir el error 404 */
    }

    /* Cuota diaria de Gemini agotada: tiene su PROPIO handler, separado del genérico de
       abajo, para que el frontend pueda distinguirlo sin comparar texto de mensaje
       (frágil) — le basta con mirar el código HTTP. 429 (Too Many Requests) es el
       código semánticamente correcto para un límite agotado, a diferencia del 400
       genérico que usa cualquier otro ApiException.
       El mensaje NO menciona Gemini ni "cuota de IA" a propósito: de qué proveedor
       depende la función, o que tiene un límite diario, es un detalle de implementación
       que no le compete al usuario final — lo único que necesita saber es que hay un
       tope diario y que hoy ya lo alcanzó. Como CuotaIaAgotadaException hereda de
       ApiException, Spring igual la manda acá por ser el handler más específico, en vez
       de caer en el genérico. */
    @ExceptionHandler(CuotaIaAgotadaException.class)
    public ResponseEntity<GenericResponse<Void>> handleCuotaIaAgotadaException(CuotaIaAgotadaException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(GenericResponse.error("Alcanzaste el límite de intentos diarios. Inténtalo de nuevo mañana."));
    }

    // Error 400, Regla Rota
    // Devuelve un HTTP 400: Tu petición está mal, corrige algo
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<GenericResponse<Void>> handleApiException(ApiException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(GenericResponse.error(ex.getMessage()));
    }

    // Se lanza al hacer flush de un ge+tReferenceById() con un ID que no existe
    // (ej: SesionRequest.noticiaId o .textoIaId apuntando a un registro borrado o inventado).
    // Sin este handler caía en el 500 genérico de más abajo; con esto el front recibe un 404 claro.
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<GenericResponse<Void>> handleEntityNotFoundException(EntityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(GenericResponse.error("El recurso referenciado no existe."));
    }

    // Validaciones fallidas (@Valid)
    // Si React envía un wpm nulo, Spring lanza este método
    @ExceptionHandler(MethodArgumentNotValidException.class)
    /*MethodArgumenteNotValidException.class -> Excepcion gigante que spring
    lanza cuando falla un @Valid */
    public ResponseEntity<GenericResponse<Map<String, String>>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        // Acá estamos prometiendo mandar un map (Diccionario) en lugar de un Void (Nulo)
        Map<String, String> errores = new HashMap<>();
        //Creamos una libreta vacía

        ex.getBindingResult().getAllErrors().forEach((error) -> {
            /*getBindingResult(): Metodo que devuelve un objeto BindingResult que es el reporte de lo que Spring validó
            .getAllErrors(): Metodo de BindingResult, devuelve un List<ObjectError> Una lista con un elemento por cada error
            .forEach -> Iniciamos un bucle dentro de la lista
            (error) -> Es el nombre que se le da a cada elemento mientras el forEach se ejecuta
             */
            String fieldName = ((FieldError) error).getField();//Dentro del bucle
            //FieldError: Es forzar a java a tratar un error general como un error específico de una variable
            //getField: Extrae el nombre del campo que falló ("wpm", "modousado")
            String errorMessage = error.getDefaultMessage();
            //getDefaultMessage: Devuelve el mensaje de validación asociado a la regla rota. ("La precisión es obligatoria)
            // Encontrando el motivo por el que ocurrió el fallo
            errores.put(fieldName, errorMessage);
            //put(clave, valor) -> Guarda o reemplaza una asociación clave-valor dentro del diccionario
        });

        GenericResponse<Map<String, String>> response = GenericResponse.<Map<String, String>>builder()
                .success(false)//Guarda como false porque efectivamente la petición falla
                .message("Error de validación en los datos enviados")
                .data(errores)//Se envían la lista de errores y el porqué fallaron
                .build();//Construye el objeto y lo guarda dentro de response

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        //Devuelve la respuesta con el http 400, con el objeto response como el cuerpo de la respuesta
    }

    // El parche de seguridad implementado (500)
    // se usa con errores impredecibles, caída de DB, disco lleno, error matemático, etc
    // Es un seguro de vida, si una excepción queda fuera de los otros
    // métodos, cae aquí. Usamos SLF4J en lugar de printStackTrace para que el error
    // se guarde correctamente en el sistema de logs con todo su contexto.
    /* CABECERA OBLIGATORIA QUE NO LLEGO -> 400, no 500.

       Sin este manejador, olvidarse de `X-Identificador-Temporal` en cualquier endpoint de
       /curso —o de `X-Admin-Key` en la pantalla de revision— caia en el catch generico de
       abajo y salia un 500. Y un 500 dice "el servidor se rompio" cuando lo que pasa es que
       la peticion venia mal armada: manda a depurar el lugar equivocado.

       Se pone en el manejador global y no endpoint por endpoint a proposito: asi cubre a los
       que ya existen y a los que se agreguen despues, sin que nadie tenga que acordarse. */
    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<GenericResponse<Object>> handleCabeceraFaltante(
            MissingRequestHeaderException ex) {
        log.warn("Petición sin la cabecera obligatoria '{}'", ex.getHeaderName());
        return ResponseEntity.badRequest().body(GenericResponse.error(
                "Falta la cabecera obligatoria: " + ex.getHeaderName()));
    }

    /* Un valor de la URL que no encaja con el tipo del parámetro: `/curso/PATATA/progreso`, o
       un id que no es un número. Sin esto caía en el catch genérico y salía un 500, que manda a
       buscar el problema en el servidor cuando está en la petición.

       El mensaje enumera los valores válidos si el destino es un enum. Cuesta dos líneas y
       ahorra tener que ir al código a ver qué se aceptaba. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<GenericResponse<Object>> handleTipoInvalido(
            MethodArgumentTypeMismatchException ex) {
        Class<?> destino = ex.getRequiredType();
        String validos = (destino != null && destino.isEnum())
                ? " Valores válidos: " + String.join(", ",
                    java.util.Arrays.stream(destino.getEnumConstants())
                            .map(Object::toString).toList())
                : "";
        log.warn("Parámetro '{}' con valor no válido: {}", ex.getName(), ex.getValue());
        return ResponseEntity.badRequest().body(GenericResponse.error(
                "El parámetro '" + ex.getName() + "' no es válido." + validos));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<GenericResponse<Void>> handleGlobalException(Exception ex) {
        log.error("Error interno no controlado", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(GenericResponse.error("Error interno del servidor. Intenta de nuevo."));
    }

    // Validaciones de @RequestHeader y @RequestParam con @Validated
    // Se activa cuando falla @Pattern u otras constraints en parámetros del controller.
    // A diferencia de MethodArgumentNotValidException (que maneja el @Valid del body),
    // esta excepción cubre los parámetros sueltos del método.
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<GenericResponse<Void>> handleConstraintViolationException(ConstraintViolationException ex) {
        String mensaje = ex.getConstraintViolations().stream()
                .map(v -> v.getMessage())
                .findFirst()
                .orElse("Parámetro de entrada inválido");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(GenericResponse.error(mensaje));
        /*.getConstraintViolations(). Método que devuelve un Set(Lista sin duplicados)
        .stream(): Convierte el Set es un Stream, una cinta transportadores, donde puedes encadenar operaciones.
        .map(V->...): Transforma cada elemento de el Stream. El stream pasa a ser de "violaciones" a "textos" (Strings)
         ,findFirst(): Toma el primer elemento del String. Deuelve un Optional<String>
         .orElse: Si el Optional está vacío usa ese texto de repuesto
         String mensaje: Guarda el resultado final. El primer mensaje de error encontrado, en una variable*/
    }
}

/* Resumen de lo que hace el GlobalExceptionHandler
Atrapa el desastre: Detiene la caída provocada por un error antes de que la web
se caiga o muestre pantallas técnicas horribles.

Lo maquilla con elegancia: Toma el mensaje feo de la falla, lo mete dentro de tu
molde estructurado (GenericResponse) y le envía a React un JSON limpio y fácil de
entender, acompañado de su código HTTP correspondiente (como 400 o 404).

En resumen: Transforma una explosión interna de código en un mensaje de texto
pacífico y ordenado para el Frontend.
 */