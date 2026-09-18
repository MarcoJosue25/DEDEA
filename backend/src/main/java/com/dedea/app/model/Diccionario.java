package com.dedea.app.model;

import com.dedea.app.model.enums.Dificultad;
import com.dedea.app.model.enums.Idioma;
import jakarta.persistence.*;
import lombok.*;

@Entity //Le comunica a spring que esta clase es una tabla
@Table(name = "diccionario") // Llama a la tabla específica de Mysql
@Getter @Setter // Genera getter and setter automaticamente
@NoArgsConstructor @AllArgsConstructor // Genera un constructor vacío para hibernate y otro para nosotros
//1ro - Hibernate necesita instanciar la clase vacía para sacar una fila de MySQL a objeto Java
//2do - Se pone para no crear un objeto vacío en el Service,
@Builder //se usa para crear objetos de forma limpia y legible, eliminando constructores grandes
public class Diccionario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) //El id se genera automáticamente
    // @private -> Ningún otro archivo puede acceder o modificar esta variable
    // Solo puedes hacerlo a través de sus getters y setter.
    private Integer id;

    /* COLACIÓN SENSIBLE A TILDES, y no es un detalle.

       La colación por defecto de estas tablas es utf8mb4_0900_ai_ci — accent-insensitive —
       y con ella MySQL responde que 'a' = 'á' es VERDADERO. Medido. En una app cuyo primer
       eje de dificultad son justamente las tildes, eso significa que pedir practicar 'á'
       devolvía palabras con 'a' pelada, y que 'de' y 'dé' eran la misma palabra: en el
       archivo semilla hay 247 grupos que colisionan así (de/dé, el/él, si/sí, tu/tú,
       como/cómo), y por eso 267 palabras se perdieron en silencio al sembrar.

       Se pone en la columna y no en la consulta a propósito: un COLLATE aplicado sobre la
       columna dentro del WHERE inutiliza el índice, igual que envolverla en una función. */
    @Column(nullable = false, unique = true, length = 100,
            columnDefinition = "VARCHAR(100) COLLATE utf8mb4_0900_as_ci")
    // nullable false = campo no puede estar vacío
    //unique true = campo no se puede repetir
    private String palabra;

    @Enumerated(EnumType.STRING) //Sin esto JPA guarda los enums como numeros
    @Column(nullable = false)
    //@column  le dice a java como quiere que se comporte la columna
    // nullable false no permite que se guarden datos vacíos
    private Dificultad dificultad;

    private Integer longitud;

    @Column(name = "frecuencia_uso", nullable = false)
    @Builder.Default //Con esto hacemos que el valor sea cero en lugar de null
                     // cuando el campo se envía vacío
    private Integer frecuenciaUso = 0;

    @Enumerated(EnumType.STRING)
    /* Se usa cuando guardamos Enums en la en MySQL, ya que por defecto se guarda
    como Int. Así guardamos la palabra como String en Mysql*/
    @Column(nullable = false)
    @Builder.Default
    private Idioma idioma = Idioma.es;
}