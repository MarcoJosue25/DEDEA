package com.dedea.app.service.impl;

import com.dedea.app.dto.LatidoResponse;
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

    /* Un nodo servido en LATIDOS se juzga en el front entre tanda y tanda, con los umbrales
       que le manda el servidor en el mismo contenido. Un nodo con latidos y sin umbrales se
       quedaría sin poder decidir; uno sin latidos no los necesita. */
    @Test
    void todoNodoConLatidosTraeSusUmbrales() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.soloCurso();

        List<String> fallas = new ArrayList<>();
        int conLatidos = 0;
        for (NivelCurso nivel : NivelCurso.values()) {
            for (Ejercicio nodo : c.senderoActivo(nivel)) {
                var r = c.servicio.generarContenido(nodo.getId(), null, null);
                boolean tieneLatidos = r.latidos() != null && !r.latidos().isEmpty();
                if (tieneLatidos) conLatidos++;
                if (tieneLatidos != (r.umbralesLatido() != null)) {
                    fallas.add(nivel + " o" + nodo.getOrden() + " \"" + nodo.getTitulo() + "\": "
                            + (tieneLatidos ? "latidos sin umbrales" : "umbrales sin latidos"));
                }
            }
        }

        assertThat(conLatidos).as("si ningún nodo tuviera latidos, el test no probaría nada").isPositive();
        assertThat(fallas).as("%n%s", String.join(System.lineSeparator(), fallas)).isEmpty();
    }

    /* EL ÚLTIMO LATIDO ES UNA TANDA COMO LAS OTRAS TRES (19-sep-2026).

       Hasta esa fecha buscaba palabras reales en el diccionario y se saltaba la dominancia
       del plan: en "w o" servía quince palabras españolas donde la `w` no aparecía nunca y
       la `o` a duras penas, o sea el latido final de un nodo donde sus dos teclas casi no
       salían. El usuario lo cortó —"nunca autoricé eso, solo que baje a 80%"— y este test
       es lo que impide que vuelva: mide la proporción real sobre muchas generaciones.

       El margen es ancho a propósito (70-90 para un objetivo de 80): son tokens al azar, no
       una cuota exacta. Con el generador viejo daba menos de 15, así que la regresión se ve
       igual. */
    @Test
    void elUltimoLatidoRespetaLaDominanciaDeSuPlan() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.soloCurso();
        Ejercicio nodo = c.porTitulo.get("Fundamentos: w o");
        assertThat(nodo).as("el nodo de la auditoría sigue existiendo").isNotNull();

        int nuevas = 0;
        int total = 0;
        for (int i = 0; i < 50; i++) {
            List<LatidoResponse> latidos = c.servicio.generarContenido(nodo.getId(), null, null).latidos();
            String ultimo = latidos.get(latidos.size() - 1).getTexto().replace(" ", "");
            for (char ch : ultimo.toCharArray()) {
                total++;
                if (ch == 'w' || ch == 'o') nuevas++;
            }
        }

        assertThat(100.0 * nuevas / total)
                .as("%% de teclas nuevas en el último latido (el plan pide 80)")
                .isBetween(70.0, 90.0);
    }

    /* El contrarreloj de la fila central: palabras sueltas, unas pocas combinaciones y UNA
       sola mayúscula. Las tres cosas las pidió el usuario en la auditoría del nivel, y las
       tres se rompen solas si alguien vuelve a apuntar el nodo a un banco de frases. */
    @Test
    void elContrarrelojDeLaFilaCentralSirvePalabrasConUnaSolaMayuscula() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.soloCurso();
        Ejercicio nodo = c.porTitulo.get("Contrarreloj: palabras de la fila central");
        assertThat(nodo).isNotNull();

        for (int i = 0; i < 30; i++) {
            String texto = c.servicio.generarContenido(nodo.getId(), null, null).texto();

            assertThat(texto.chars().filter(Character::isUpperCase).count())
                    .as("una mayúscula y solo una: %s", texto).isEqualTo(1);
            assertThat(Character.isUpperCase(texto.charAt(0)))
                    .as("y va en la primera letra: %s", texto).isTrue();
            assertThat(texto.split(" ").length)
                    .as("veinte palabras más las combinaciones").isGreaterThan(20);

            String enMinuscula = texto.toLowerCase();
            assertThat(ContenidoCurado.COMBINACIONES_BASICO_LINEA_BASE)
                    .as("alguna combinación del banco aparece entera en: %s", texto)
                    .anyMatch(enMinuscula::contains);
        }
    }

    /* La lluvia de repaso cae FILA POR FILA: tres tramos de cuatro teclas, y las cuatro de
       cada tramo pertenecen a la misma fila. La de abajo va sin la coma, el punto ni el
       guion — decisión del usuario: este nodo cierra el repaso de las LETRAS del nivel.

       Sin identificador no hay historial, así que salen los respaldos de cada fila; es el
       mismo camino que el de un usuario nuevo. */
    @Test
    void laLluviaDeRepasoCaeFilaPorFila() throws Exception {
        CatalogoEnMemoria c = CatalogoEnMemoria.soloCurso();
        Ejercicio nodo = c.porTitulo.get("Lluvia de repaso: tus teclas más falladas");
        assertThat(nodo).isNotNull();

        String[] tramos = c.servicio.generarContenido(nodo.getId(), null, null).texto().split("\n");
        assertThat(tramos).as("un tramo por fila del teclado").hasSize(3);

        List<String> filas = List.of("asdfghjklñ", "qwertyuiop", "zxcvbnm");
        for (int i = 0; i < tramos.length; i++) {
            String fila = filas.get(i);
            Set<String> teclas = new HashSet<>(List.of(tramos[i].trim().split(" ")));
            assertThat(teclas).as("cuatro teclas en el tramo %d", i).hasSize(4);
            assertThat(teclas).as("todas de la fila %s", fila)
                    .allMatch(t -> fila.contains(t));
        }
    }

    private static List<Ejercicio> conRol(List<Ejercicio> ejercicios, RolEjercicioNivel rol) {
        return ejercicios.stream().filter(e -> e.getRolEnNivel() == rol).toList();
    }
}
