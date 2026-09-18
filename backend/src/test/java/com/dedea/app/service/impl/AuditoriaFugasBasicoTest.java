package com.dedea.app.service.impl;

import com.dedea.app.dto.EjercicioContenidoResponse;
import com.dedea.app.dto.LatidoResponse;
import com.dedea.app.model.Ejercicio;
import com.dedea.app.model.enums.NivelCurso;
import com.dedea.app.model.enums.TipoEjercicio;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/* La auditoría del 7-sep-2026, convertida en test: NINGÚN nodo del Curso Básico puede pedir
   una tecla antes del nodo que la enseña.

   El fallo que busca es mudo: si una tecla llega antes de tiempo, el ejercicio genera texto
   igual y nada avisa. Hasta ahora se revisaba a mano contra la API, y hubo que repetirla
   cada vez que se reordenaba el sendero — cosa que no siempre se hizo.

   Corre sin base de datos, sobre CatalogoEnMemoria: el catálogo real sembrado en memoria.

   Qué cuenta como "enseñado" hasta un nodo, sacado del propio catálogo y no de una lista
   escrita acá (si el sendero se reordena, el test se reordena solo):
   - las teclas de cada nodo de Fundamentos anterior o igual, más sus secundarias;
   - el espacio y el salto entre tandas;
   - la mayúscula de cualquier letra enseñada (misma tecla, con Shift);
   - las vocales con tilde desde el nodo con `tildeObligatoria`;
   - los dígitos desde el nodo con `progresionNumerica`.
   La Prueba de nivel (orden 0) queda fuera a propósito: muestrea a quien puede no haber
   abierto un solo nodo. */
class AuditoriaFugasBasicoTest {

    /* Cada generación es al azar (bancos barajados, sílabas sorteadas), así que un nodo se
       genera muchas veces. Una fuga que sale una vez de cada diez no puede esconderse acá. */
    private static final int REPETICIONES = 200;

    private final ObjectMapper json = new ObjectMapper();
    private CatalogoEnMemoria catalogo;

    @BeforeEach
    void sembrar() throws Exception {
        catalogo = CatalogoEnMemoria.soloCurso();
    }

    @Test
    void ningunNodoDeBasicoPideUnaTeclaAntesDeEnsenarla() throws Exception {
        List<Ejercicio> sendero = catalogo.senderoActivo(NivelCurso.BASICO);
        assertThat(sendero).as("el sendero de Básico no se sembró").isNotEmpty();

        List<String> fugas = new ArrayList<>();
        for (Ejercicio nodo : sendero) {
            Set<Character> permitidas = ensenadasHasta(nodo.getOrden(), sendero);
            Map<Character, String> fuera = new TreeMap<>();

            for (int i = 0; i < REPETICIONES; i++) {
                for (String texto : textosQueSeTeclean(nodo)) {
                    for (int p = 0; p < texto.length(); p++) {
                        char c = texto.charAt(p);
                        if (!permitidas.contains(c)) {
                            fuera.putIfAbsent(c, contexto(texto, p));
                        }
                    }
                }
            }

            fuera.forEach((c, ejemplo) -> fugas.add(String.format(
                    "o%d \"%s\": '%s' (U+%04X) antes de enseñarse — …%s…",
                    nodo.getOrden(), nodo.getTitulo(), c, (int) c, ejemplo)));
        }

        assertThat(fugas)
                .as("Teclas que aparecen antes del nodo que las enseña:%n%s",
                        String.join(System.lineSeparator(), fugas))
                .isEmpty();
    }

    // --- Qué se teclea en un nodo -------------------------------------------------------

    /* Todo lo que el usuario tiene que TECLEAR en una vuelta del nodo: el texto (con sus
       tandas), cada latido, el quinto latido y los ítems del tutorial. Los rótulos
       (mensajeTutorial, captionsTutorial, introTexto) no entran: se leen, no se teclean. */
    private List<String> textosQueSeTeclean(Ejercicio nodo) {
        List<String> textos = new ArrayList<>();
        EjercicioContenidoResponse r = catalogo.servicio.generarContenido(nodo.getId(), null, null);
        textos.add(r.texto());
        if (r.latidos() != null) {
            r.latidos().stream().map(LatidoResponse::getTexto).forEach(textos::add);
        }
        if (r.teclasTutorial() != null) textos.addAll(r.teclasTutorial());

        if (nodo.getTipo() == TipoEjercicio.LETRAS_BASICO || nodo.getTipo() == TipoEjercicio.UN_DEDO) {
            LatidoResponse quinto = catalogo.servicio.generarUltimoIntento(nodo.getId(), null);
            if (quinto != null) textos.add(quinto.getTexto());
        }
        return textos.stream().filter(Objects::nonNull).toList();
    }

    // --- Qué está enseñado hasta un orden ------------------------------------------------

    private Set<Character> ensenadasHasta(int orden, List<Ejercicio> sendero) throws Exception {
        Set<Character> letras = new HashSet<>();
        Integer ordenTilde = null;
        Integer ordenDigitos = null;

        for (Ejercicio e : sendero) {
            Map<String, Object> config = leerConfig(e);
            if (Boolean.TRUE.equals(config.get("tildeObligatoria"))) ordenTilde = e.getOrden();
            if (Boolean.TRUE.equals(config.get("progresionNumerica"))) ordenDigitos = e.getOrden();

            if (e.getTipo() != TipoEjercicio.LETRAS_BASICO || e.getOrden() > orden) continue;
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> filas = (List<Map<String, Object>>) config.get("filas");
            for (Map<String, Object> fila : filas) {
                @SuppressWarnings("unchecked")
                List<String> pasos = (List<String>) fila.get("pasos");
                pasos.forEach(paso -> agregar(letras, paso.replace(" ", "")));
            }
            if (config.get("secundarias") instanceof String s) agregar(letras, s);
        }

        assertThat(ordenTilde).as("no hay ningún nodo con tildeObligatoria").isNotNull();
        assertThat(ordenDigitos).as("no hay ningún nodo con progresionNumerica").isNotNull();

        Set<Character> permitidas = new HashSet<>(letras);
        letras.forEach(c -> permitidas.add(Character.toUpperCase(c)));
        permitidas.add(' ');
        permitidas.add('\n');
        if (orden >= ordenTilde) agregar(permitidas, "áéíóúÁÉÍÓÚ");
        if (orden >= ordenDigitos) agregar(permitidas, "0123456789");
        return permitidas;
    }

    private Map<String, Object> leerConfig(Ejercicio e) throws Exception {
        if (e.getConfiguracion() == null || e.getConfiguracion().isBlank()) return Map.of();
        return json.readValue(e.getConfiguracion(), new TypeReference<>() {});
    }

    private static void agregar(Set<Character> destino, String caracteres) {
        caracteres.chars().forEach(c -> destino.add((char) c));
    }

    private static String contexto(String texto, int posicion) {
        int desde = Math.max(0, posicion - 12);
        int hasta = Math.min(texto.length(), posicion + 12);
        return texto.substring(desde, hasta).replace("\n", "⏎");
    }
}
