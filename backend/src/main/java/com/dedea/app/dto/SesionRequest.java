package com.dedea.app.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SesionRequest {
    private Integer usuarioId;
    private Integer noticiaId;
    private Integer textoIaId;

    @NotNull @Min(0)
    // @NotNull evita que el valor llegue nulo
    // @Min le dice a Spring no solo verifiques que sea nulo, asegúrate que el número tenga
    // sentido lógico, no puedes poner -5 de wpm
    // Min(0) -> No puedes jugar una partida de 0 segundos
    private Integer wpm;

    @NotNull(message = "La precisión es obligatoria")
    @DecimalMin(value = "0.0", message = "La precisión no puede ser negativa")
    @DecimalMax(value = "100.0", message = "La precisión máxima es 100.00")
    private BigDecimal precision;

    // Tanto segundos como modoUsado son campos que permiten
    // filtrar información en la DB
    @NotNull @Min(1)
    // @Min(1)-> Exijo mínimo 1 segundo de duración
    private Integer segundos;

    @NotBlank
    // Impide que el valor sea nulo ni texto vacío o puro espacio
    private String modoUsado; // noticias, ia, libre

    @NotBlank
    private String dificultad; // facil, medio, dificil

    @Valid
    private List<SesionProgresoDTO> progreso; // Mantiene DTO porque es solo transporte plano

    // CAMBIO V2: Ahora apuntan a estructuras blindadas de Request
    // @Valid Crea un efecto de validación en cascada aplicando
    // NotNull y NotBlank en cada elemento de la lista que nos manda React
    @Valid
    private List<TeclaStatsRequest> teclas;

    @Valid
    private List<NgramStatsRequest> ngrams;

    /* 4. Dimensión de ritmo: la pulsación individual con su milisegundo exacto.
       Antes solo la mandaba Curso (nació para el modo sombra), pero de acá sale también el
       tiempo por tecla del mapa de calor, y las sesiones de texto largo son justo las que
       mejor representan cómo escribe el usuario. Opcional a propósito: una sesión sin
       eventos se guarda igual, solo pierde el análisis de ritmo. */
    @Valid
    private List<TeclaEventoRequest> eventos;
}
/*
    SesionRequest: DTO puramente transaccional encargado de transportar el payload
    unificado de una partida finalizada desde React hacia el Backend.
    No procesa lógica; actúa como un contenedor plano de tres dimensiones analíticas:
    * 1. List<SesionProgresoDTO>: Dimensión Temporal. Captura el rendimiento (WPM y Precisión)
    segundo a segundo para pintar el gráfico de líneas histórico en el perfil del usuario.
    * 2. List<TeclaStatsRequest>: Dimensión Biométrica (Batching). Agrupa el rendimiento total
    de cada tecla física durante la sesión para alimentar el mapa de calor (Heatmap) del teclado.
    Evita la saturación enviando un lote compacto acumulado en lugar de pulsaciones individuales.
    * 3. List<NgramStatsRequest>: Dimensión Adaptativa. Registra los aciertos y fallas en bigramas
    y trigramas (combos de letras) para que el motor inteligente de Dedea detecte debilidades
    y personalice las futuras prácticas mediante la IA.
 */