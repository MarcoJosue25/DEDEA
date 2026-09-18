package com.dedea.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TextoIaRequest {
    @NotBlank(message = "La dificultad es obligatoria")
    //Impide que el valor sea nulo ni texto vacío o puro espacio
    private String dificultad; // facil, medio, dificil

    /* Sin tope ni patrón, este endpoint confiaba ciegamente en lo que mandara el
       cliente: estos valores se pegan tal cual dentro del prompt que recibe Gemini (ver
       IaServiceImpl.construirPromptSistema), así que una petición armada a mano —sin
       pasar por la pantalla— podía meter cualquier texto ahí, una inyección de prompt
       directa. El @Size evita además una lista gigante que infle el prompt o abra una vía
       barata de gastar la cuota diaria de Gemini con pedidos triviales. No hace falta
       @Valid en el campo: las restricciones van sobre el tipo del elemento
       (List<@Pattern String>), y @Valid ya está en IaController sobre el objeto completo
       — eso alcanza para que se validen también los elementos de la lista.

       LO QUE DE VERDAD CIERRA LA INYECCIÓN ES EL LARGO, NO EL ALFABETO. Una instrucción
       necesita espacios y largo variable; 10 elementos de 1 a 3 caracteres, ninguno de
       ellos un espacio, no pueden formar ninguna. Por eso ampliar el alfabeto no reabre
       el agujero. (El valor tampoco puede romper el .formatted() del prompt: teclas y
       n-gramas viajan como ARGUMENTOS, no dentro de la cadena de formato, así que un "%"
       no se interpreta.)

       Y había que ampliarlo, porque el patrón viejo —solo letras españolas— rechazaba
       teclas y n-gramas REALES del propio producto. Medido el 25-ago-2026 sobre la base:
       `sesion_teclas` guarda `: ; % $ ( ) [ ] { } = _ - / \ # < > ! ¡ ? ¿ " '` y los diez
       dígitos, y `sesion_ngrams` guarda `a.`, `os,`, `s,`. Los símbolos entraron por dos
       puertas: las noticias de nivel DIFICIL, que los piden a propósito, y el ejercicio
       "Maratón de símbolos", cuya config es justamente { } [ ] # $ ! % ( ) < > / \ - _ =.

       El síntoma era un 400 en /ia/generar cada vez que la pantalla ofrecía uno de esos
       como debilidad y el usuario lo elegía: la ficha existía, era legítima, y el backend
       la rechazaba. Aparece seis veces en el log del 25-ago.

       El ESPACIO queda fuera a propósito, aunque sea la tecla más pulsada del historial:
       como objetivo de práctica para la IA no significa nada ("elige palabras que
       contengan la letra ' '") y su ficha se dibujaría vacía. Si algún día su tasa de
       error cruza el umbral y llega a la pantalla, el arreglo es no ofrecerla, no
       aceptarla acá.

       Una sola constante para los dos patrones: son la misma clase de carácter, y tenerla
       escrita dos veces es la trampa de las listas que se sincronizan a mano. */
    private static final String CARACTER_TECLEABLE =
            "[a-záéíóúñü0-9.,:;()\\[\\]{}\"'!¡?¿=+*/\\\\<>%$@#&|~\\^´°_-]";

    @Size(max = 10, message = "Demasiadas teclas seleccionadas.")
    private List<@Pattern(regexp = "^" + CARACTER_TECLEABLE + "$",
            message = "Cada tecla debe ser un solo carácter válido.") String> teclasDebiles; // Ej: ["h", "%"]

    @Size(max = 10, message = "Demasiadas combinaciones seleccionadas.")
    private List<@Pattern(regexp = "^" + CARACTER_TECLEABLE + "{2,3}$",
            message = "Cada combinación debe tener 2 o 3 caracteres.") String> ngramsDebiles; // Ej: ["tr", "os,"]
}
