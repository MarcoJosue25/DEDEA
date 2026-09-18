package com.dedea.app.service;

import java.util.List;

public interface DictionaryService {

    // Método para poblar la base de datos (Ej: desde un script o un panel de admin)
    void agregarPalabra(String palabraCruda);

    /* Igual, pero conservando la posicion que la palabra tenia en la lista de frecuencia de
       origen (1 = la mas usada del idioma). Sin esto el dato se pierde al activar y no hay
       forma de pedir "las 2.000 mas comunes", que es justo lo que hace falta cuando el
       diccionario pasa de 8.000 a 50.000 palabras. */
    void agregarPalabra(String palabraCruda, Integer rangoFrecuencia);

    // Método que consumirá el IaService o el Frontend
    List<String> obtenerPalabrasAleatorias(String ngram, String dificultad, int limite);

    // Carga las palabras base del diccionario (seed/palabras_es.txt) en segundo plano
}

