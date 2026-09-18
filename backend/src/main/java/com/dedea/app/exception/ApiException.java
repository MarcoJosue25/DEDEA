package com.dedea.app.exception;

//La clase hereda de RuntimeException
// Esta clase es una alarma de "Regla Rota"
// Se usa para reglas de negocio o errores lógicos
// Si se pide un texto a Gemini pero se superaron los intentos
// del día, El IaService hace sonar esta alarma:
// throw new ApiException("Has alcanzado tu límite diario de generación de textos por IA");
public class ApiException extends RuntimeException {
    public ApiException(String message) {
        super(message);
    }
}

/*Esta clase es vacía (Guarda un constructor vacío) y no guarda métodos porque hereda todos los métodos de la
  clase padre la cual es RuntimeException, Es básicamente una etiqueta o nombre personalizado
  para que el GlobalExceptionHandler distinga entre un error de IA y uno de dato no encontrado
 */

/*
ApiExcepton y ResourceNotFoundException Guardan un constructor que recibe el mensaje de error.
Están vacíos porque al heredar de RuntimeException reciben métodos súpero complejos como:
getMessaeg(), printStackTrace(), getStackTrace().
Actúan como etiqueta o nombre personalizado de la clase padre
IMPORTANTE:
super (message): Cuando el service ejecuta ResourceNotFoundException("La noticia no existe")
la clase agarra este texto(mensaje) y con este método lo manda a la clase padre.
COMO FUNCIONA EL DESCATIVADO DE ERRORES
El service la lanza (throw), corta el metodo y sube sin control por el controller hasta que
Spring (por el @RestControllerAdvice) la intercepta sola y la convierte en una respuesta HTTP
normal en GlobalExceptionHandler.
*/

