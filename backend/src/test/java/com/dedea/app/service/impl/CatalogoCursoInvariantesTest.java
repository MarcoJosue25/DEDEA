package com.dedea.app.service.impl;

import com.dedea.app.model.Ejercicio;
import com.dedea.app.model.enums.NivelCurso;
import com.dedea.app.model.enums.RolEjercicioNivel;
import com.dedea.app.util.ContenidoCurado;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/* Las reglas del sembrado del catálogo, que hasta ahora vivían en CLAUDE.md como "trampas".

   El sembrado busca cada ejercicio por su TÍTULO. Eso mordió seis veces: renombrar un nodo
   creaba uno nuevo y dejaba el viejo activo, y dos llamadas con el mismo título hacían que
   la segunda pisara a la primera sin avisar. Estos tests siembran desde cero y comprueban
   el resultado, así que el fallo aparece acá y no en el sendero del usuario. */
class CatalogoCursoInvariantesTest {

    /* Un título, un ejercicio. Si dos llamadas usan el mismo título, la segunda "repurposea"
       a la primera: le cambia el nivel, el orden o el tipo. Sembrando desde cero eso se ve
       como un título que pasó por dos lugares distintos. Incluye a Ejercicios Base: un título
       del Curso igual a uno de la Base le roba la fila. */
    @Test
    void ningunTituloSeUsaParaDosEjerciciosDistintos() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.completo();

        Map<String, Set<String>> lugaresPorTitulo = new TreeMap<>();
        for (CatalogoEnMemoria.Huella h : c.guardados) {
            if (!h.activo()) continue;  // el retiro cambia el orden a propósito
            lugaresPorTitulo.computeIfAbsent(h.titulo(), t -> new LinkedHashSet<>())
                    .add(h.nivel() + " orden " + h.orden() + " " + h.tipo());
        }

        List<String> repetidos = lugaresPorTitulo.entrySet().stream()
                .filter(e -> e.getValue().size() > 1)
                .map(e -> "\"" + e.getKey() + "\" → " + e.getValue())
                .toList();

        assertThat(repetidos)
                .as("Títulos usados para más de un ejercicio:%n%s", String.join(System.lineSeparator(), repetidos))
                .isEmpty();
    }

    /* Sembrando desde cero nada debería terminar inactivo: si pasa, un título está a la vez
       en la lista de sembrado y en RETIRADOS_DEL_CURSO, y el nodo se crea y se retira en la
       misma pasada — desaparece del sendero sin ningún error. */
    @Test
    void enUnSembradoDesdeCeroNadaQuedaRetirado() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.completo();

        List<String> retirados = c.porId.values().stream()
                .filter(e -> !Boolean.TRUE.equals(e.getActivo()))
                .map(Ejercicio::getTitulo)
                .sorted()
                .toList();

        assertThat(retirados).as("Ejercicios creados y retirados en la misma pasada").isEmpty();
    }

    @Test
    void cadaNivelTieneUnSoloNodoPorOrden() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.soloCurso();

        for (NivelCurso nivel : NivelCurso.values()) {
            Map<Integer, List<String>> porOrden = c.senderoActivo(nivel).stream()
                    .collect(Collectors.groupingBy(Ejercicio::getOrden, TreeMap::new,
                            Collectors.mapping(Ejercicio::getTitulo, Collectors.toList())));

            List<String> choques = porOrden.entrySet().stream()
                    .filter(e -> e.getValue().size() > 1)
                    .map(e -> "orden " + e.getKey() + ": " + e.getValue())
                    .toList();

            assertThat(choques).as("%s tiene dos nodos en el mismo orden", nivel).isEmpty();
        }
    }

    /* Básico e Intermedio no tienen huecos: un número que falta es un nodo que se perdió.
       Avanzado arranca en el 2 a propósito (el 1 queda para su Test de nivel), así que no se
       mira acá. Intermedio tuvo huecos deliberados hasta que se reorganizó (CLAUDE.md 6.5). */
    @Test
    void losSenderosDeBasicoEIntermedioNoTienenHuecos() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.soloCurso();

        for (NivelCurso nivel : List.of(NivelCurso.BASICO, NivelCurso.INTERMEDIO)) {
            List<Integer> ordenes = c.senderoActivo(nivel).stream()
                    .map(Ejercicio::getOrden).toList();

            assertThat(ordenes).as("%s con huecos", nivel)
                    .isEqualTo(IntStream.rangeClosed(1, ordenes.size()).boxed().toList());
        }
    }

    /* Los dos ejercicios de control: a lo sumo uno de cada uno por nivel, la Prueba de nivel
       fuera del sendero (orden 0) y el Test Final cerrándolo. Básico tiene los dos. */
    @Test
    void losTestsDeControlEstanDondeTienenQueEstar() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.soloCurso();

        for (NivelCurso nivel : NivelCurso.values()) {
            List<Ejercicio> delNivel = c.porId.values().stream()
                    .filter(e -> e.getNivel() == nivel && Boolean.TRUE.equals(e.getActivo()))
                    .toList();
            List<Ejercicio> finales = conRol(delNivel, RolEjercicioNivel.TEST_FINAL);
            List<Ejercicio> pruebas = conRol(delNivel, RolEjercicioNivel.TEST_NIVEL);

            assertThat(finales).as("%s: Test Final repetido", nivel).hasSizeLessThanOrEqualTo(1);
            assertThat(pruebas).as("%s: Prueba de nivel repetida", nivel).hasSizeLessThanOrEqualTo(1);

            pruebas.forEach(p -> assertThat(p.getOrden())
                    .as("%s: la Prueba de nivel va fuera del sendero", nivel).isZero());

            int ultimoOrden = c.senderoActivo(nivel).stream()
                    .mapToInt(Ejercicio::getOrden).max().orElse(0);
            finales.forEach(f -> assertThat(f.getOrden())
                    .as("%s: el Test Final tiene que cerrar el sendero", nivel).isEqualTo(ultimoOrden));
        }

        List<Ejercicio> basico = c.porId.values().stream()
                .filter(e -> e.getNivel() == NivelCurso.BASICO && Boolean.TRUE.equals(e.getActivo()))
                .toList();
        assertThat(conRol(basico, RolEjercicioNivel.TEST_FINAL)).hasSize(1);
        assertThat(conRol(basico, RolEjercicioNivel.TEST_NIVEL)).hasSize(1);

        // Intermedio: solo el Test Final, sin Prueba de nivel (decisión del 18-sep-2026).
        List<Ejercicio> intermedio = c.porId.values().stream()
                .filter(e -> e.getNivel() == NivelCurso.INTERMEDIO && Boolean.TRUE.equals(e.getActivo()))
                .toList();
        assertThat(conRol(intermedio, RolEjercicioNivel.TEST_FINAL)).hasSize(1);
        assertThat(conRol(intermedio, RolEjercicioNivel.TEST_NIVEL)).isEmpty();
    }

    /* El examen de Intermedio tiene cuatro textos y sirve UNO al azar en cada intento (pedido
       del usuario: se repite hasta aprobarlo). Uno entero, no pegado a otro, y a lo largo de
       los intentos salen los cuatro. */
    @Test
    void elTestFinalDeIntermedioSirveUnoDeSusCuatroTextos() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.soloCurso();
        Ejercicio examen = c.porId.values().stream()
                .filter(e -> e.getNivel() == NivelCurso.INTERMEDIO
                        && e.getRolEnNivel() == RolEjercicioNivel.TEST_FINAL)
                .findFirst().orElseThrow();

        Set<String> salieron = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            String texto = c.servicio.generarContenido(examen.getId(), null, null).texto();
            assertThat(ContenidoCurado.TEXTO_TEST_FINAL_INTERMEDIO).as("un texto entero del banco")
                    .contains(texto);
            salieron.add(texto);
        }
        assertThat(salieron).hasSize(ContenidoCurado.TEXTO_TEST_FINAL_INTERMEDIO.size());
    }

    /* Una configuración con el JSON roto no revienta: `parsearConfiguracion` la registra y
       devuelve un mapa VACÍO, y el ejercicio se genera con los valores por defecto. O sea que
       un typo en una comilla cambia el ejercicio en silencio. Acá no pasa ninguno. */
    @Test
    void todasLasConfiguracionesSonJsonValido() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.completo();
        ObjectMapper json = new ObjectMapper();

        List<String> rotos = new ArrayList<>();
        for (Ejercicio e : c.porId.values()) {
            if (e.getConfiguracion() == null || e.getConfiguracion().isBlank()) continue;
            try {
                json.readTree(e.getConfiguracion());
            } catch (Exception ex) {
                rotos.add("\"" + e.getTitulo() + "\": " + ex.getMessage().lines().findFirst().orElse(""));
            }
        }

        assertThat(rotos).as("Configuraciones con JSON inválido:%n%s", String.join(System.lineSeparator(), rotos))
                .isEmpty();
    }

    /* Todo nodo activo de los tres niveles tiene que poder generarse. Un tipo sin generador,
       o un banco que quedó vacío, hoy se descubre recién cuando alguien abre ese nodo. */
    @Test
    void todoNodoDelSenderoGeneraContenido() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.soloCurso();

        List<String> fallas = new ArrayList<>();
        for (NivelCurso nivel : NivelCurso.values()) {
            for (Ejercicio nodo : c.senderoActivo(nivel)) {
                try {
                    var r = c.servicio.generarContenido(nodo.getId(), null, null);
                    boolean vacio = (r.texto() == null || r.texto().isBlank())
                            && (r.latidos() == null || r.latidos().isEmpty());
                    if (vacio) fallas.add(nivel + " o" + nodo.getOrden() + " \"" + nodo.getTitulo() + "\": texto vacío");
                } catch (Exception ex) {
                    fallas.add(nivel + " o" + nodo.getOrden() + " \"" + nodo.getTitulo() + "\": "
                            + ex.getClass().getSimpleName() + " — " + ex.getMessage());
                }
            }
        }

        assertThat(fallas).as("Nodos que no generan contenido:%n%s", String.join(System.lineSeparator(), fallas))
                .isEmpty();
    }

    private static List<Ejercicio> conRol(List<Ejercicio> ejercicios, RolEjercicioNivel rol) {
        return ejercicios.stream().filter(e -> e.getRolEnNivel() == rol).toList();
    }
}
