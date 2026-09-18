package com.dedea.app.exception;

// (Extends) Esta clase hereda de RuntimeException
// Esta clase es una alarma de "Este dato no existe"
// Se enciende cuando alguien pide algo que no está en la DB
// De esta forma en lugar de devolver un null y dar error, el service
// llama a throw new ResourceNotFoundException("La noticia con id # no fue encontrada")
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
// Estamos creando un constructor, el texto se guarda en la variable message
// Super se encarga de llamar al padre


