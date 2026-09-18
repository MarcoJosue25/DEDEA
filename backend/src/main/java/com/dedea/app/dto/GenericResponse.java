package com.dedea.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder

// Este es un patrón de diseño implementado en Spring Boot.
// La clase guarda un objeto temporal que se crea y se elimina de la ram luego de ser consumido en el front
// La <T> es un comodín o espacio en blanco (Llamado también Generics)
// La T Type. También se conoce como una variable para tipos de datos
// Estamos creando una caja que tiene un estado (success) y un mensaje (message)
// Si el controller devuelve noticia la caja se adapta -> GenericResponse<List<NoticiaDTO>>
// Si se envían 10 N-Grams la caja se adapta así       -> GenericResponse<List<NgramDTO>>
// Si se envía un mal dato -> GenericResponse<String> y data va en null
// Con GenericResponse todas las respuestas del servidor tienen la misma forma
//Sirve mucho como ayuda en el Front

/* <T> Declaramos la clases como genérica, envuelve cualquier tipo de dato.
    T  Actúa como un tipo de dato

 */
public class GenericResponse<T> {

    private boolean success;
    private String message;
    private T data;

    // Métodos estáticos de ayuda para que sea fácil de usar en el Controller

    /*<T>: Declara el nombre del tipo genérico que se usará en el resto de la firma
    GenericResponse<T>: Es el tipo de retorno del método
    T data: Es el tipo de dato del parámetro que recibe el dato real
    Arma la caja indicando que todo salió perfecto y mete el producto dentro de (data)*/

    public static <T> GenericResponse<T> success(String message, T data) {
        return GenericResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .build();
    }

    //Arma la caja indicando que hubo un problema y la envía vacía
    public static <T> GenericResponse<T> error(String message) {
        return GenericResponse.<T>builder()
                .success(false)
                .message(message)
                .data(null)
                .build();
    }
}

/*
Esta clase está diseñada exclusivamente para ser el molde de envoltura de las respuestas
HTTP que salen del Controller hacia el Frontend
 */