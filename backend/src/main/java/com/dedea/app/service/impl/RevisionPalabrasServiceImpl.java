package com.dedea.app.service.impl;

import com.dedea.app.dto.BusquedaPalabrasResponse;
import com.dedea.app.dto.PalabraRevisionDTO;
import com.dedea.app.dto.ResumenRevisionResponse;
import com.dedea.app.exception.ApiException;
import com.dedea.app.model.Diccionario;
import com.dedea.app.model.PalabraRevision;
import com.dedea.app.model.enums.EstadoRevision;
import com.dedea.app.repository.DiccionarioNgramRepository;
import com.dedea.app.repository.DiccionarioRepository;
import com.dedea.app.repository.PalabraRevisionRepository;
import com.dedea.app.service.DictionaryService;
import com.dedea.app.service.RevisionPalabrasService;
import com.dedea.app.util.FiltroPalabra;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

@Slf4j
@Service
@RequiredArgsConstructor
public class RevisionPalabrasServiceImpl implements RevisionPalabrasService {

    private final PalabraRevisionRepository revisionRepository;
    private final DiccionarioRepository diccionarioRepository;
    private final DiccionarioNgramRepository ngramRepository;
    private final DictionaryService dictionaryService;

    /* Tope del modo prefijo. Ahí una sola letra puede traer miles de filas, así que el corte
       es necesario. El modo exacto NO lo usa: `palabra` es UNIQUE, o sea que cada término
       trae como mucho una fila y el resultado ya viene acotado por lo que se pidió. */
    private static final int TOPE_BUSQUEDA_PREFIJO = 50;

    /* Cuántos términos se aceptan en una búsqueda por lista. Coincide con el tope del lote de
       CambioEstadoLoteRequest a propósito: si se pudieran buscar más de los que se pueden
       mover, el botón dejaría fuera parte de lo que el usuario está viendo. */
    private static final int TOPE_TERMINOS = 500;

    /* El largo de la columna `palabra`. Un término más largo no puede existir en la tabla, así
       que se descarta antes de consultar en vez de crear una fila imposible de guardar. */
    private static final int LARGO_MAXIMO_PALABRA = 100;

    /* Separador de términos del buscador. Va como Pattern y NO como un String suelto dentro
       de split() por una trampa que ya costó datos: escrito `split("\s+")`, con una sola
       barra, esto COMPILA sin avisar —desde Java 15 `\s` es un escape válido en una cadena y
       significa un espacio literal— así que el patrón se convertía en `" +"` y partía solo por
       espacios, nunca por saltos de línea. Al pegar una lista de varias líneas, las palabras
       del borde se unían en una sola y se creaban como filas basura: un "brian" al final de
       una línea y un "carl" al principio de la siguiente entraron como UNA palabra.

       Con Pattern.compile el patrón se escribe una vez, se valida al arrancar la clase y el
       error de escape queda a la vista. Se separa también por comas y punto y coma porque una
       lista pegada de otro lado suele venir con ellas. */
    private static final java.util.regex.Pattern SEPARADOR =
            java.util.regex.Pattern.compile("[\\s,;]+");

    /* El archivo de la fuente original (hermitdave/FrequencyWords) trae DOS columnas
       —`de 14459520`, la palabra y su número de apariciones— separadas por un espacio,
       mientras que `palabras_es.txt` trae una sola. Quedarse con el primer campo cubre los
       dos formatos: en un archivo de una columna el primer campo ES la línea entera.

       Antes se tomaba la línea completa como palabra, y con el archivo de 50.000 eso no
       fallaba con un error: `FiltroPalabra` rechazaba las 50.000 por el espacio y entraban
       todas a NO_PERMITIDA. El daño no habría sido la basura sino el filtro permanente —esa
       tabla es lo que impide volver a proponer lo ya decidido, así que una entrada como
       "de 14459520" se queda ahí para siempre sin significar nada. */
    private static String primerCampo(String linea) {
        String t = linea.trim();
        int corte = 0;
        while (corte < t.length() && !Character.isWhitespace(t.charAt(corte))) {
            corte++;
        }
        return t.substring(0, corte).toLowerCase(Locale.ROOT);
    }

    @Override
    @Transactional
    public ResumenRevisionResponse importarArchivo(String nombreArchivoSeed) {
        /* Se cargan de una vez las palabras que ya conocemos, en cualquier estado. Preguntar
           a la base una por una son 50.000 consultas; con el set en memoria son cero.

           Y esto es lo que hace que NO_PERMITIDA sirva de filtro permanente: una palabra
           rechazada hace tres meses ya está en el set, así que la importación nueva ni la
           mira. Es la razón de ser de la tabla. */
        Set<String> conocidas = new HashSet<>(revisionRepository.todasLasPalabras());

        List<PalabraRevision> nuevas = new ArrayList<>();
        int leidas = 0, rechazadas = 0, repetidas = 0;

        try (BufferedReader lector = new BufferedReader(new InputStreamReader(
                new ClassPathResource("seed/" + nombreArchivoSeed).getInputStream(),
                StandardCharsets.UTF_8))) {

            String linea;
            while ((linea = lector.readLine()) != null) {
                String palabra = primerCampo(linea);
                if (palabra.isEmpty()) {
                    continue;
                }
                leidas++;

                /* El rango es la POSICIÓN EN EL ARCHIVO, no un contador de las aceptadas: el
                   archivo viene ordenado por frecuencia de uso, así que la línea 1 es la
                   palabra más común del idioma. Si se contara solo lo aceptado, el rango se
                   correría y dejaría de ser comparable entre importaciones. */
                if (!conocidas.add(palabra)) {
                    repetidas++;
                    continue;
                }

                String motivo = FiltroPalabra.motivoRechazo(palabra);
                if (motivo != null) {
                    rechazadas++;
                }

                nuevas.add(PalabraRevision.builder()
                        .palabra(palabra)
                        .estado(motivo == null ? EstadoRevision.PENDIENTE : EstadoRevision.NO_PERMITIDA)
                        .rangoFrecuencia(leidas)
                        .motivoRechazo(motivo)
                        .sospecha(motivo == null ? FiltroPalabra.sospecha(palabra) : null)
                        .build());
            }
        } catch (Exception e) {
            log.error("No se pudo leer el archivo seed/{}: {}", nombreArchivoSeed, e.getMessage());
            throw new ApiException("No se pudo leer el archivo " + nombreArchivoSeed);
        }

        revisionRepository.saveAll(nuevas);
        String detalle = String.format(
                "%s: %d leídas, %d nuevas (%d a revisar, %d rechazadas por el filtro), %d ya conocidas.",
                nombreArchivoSeed, leidas, nuevas.size(), nuevas.size() - rechazadas, rechazadas, repetidas);
        log.info(detalle);
        return resumenCon(detalle);
    }

    @Override
    @Transactional
    public ResumenRevisionResponse migrarDiccionarioActivo() {
        Set<String> conocidas = new HashSet<>(revisionRepository.todasLasPalabras());
        List<Diccionario> activas = diccionarioRepository.findAll();

        List<PalabraRevision> nuevas = new ArrayList<>();
        for (Diccionario d : activas) {
            if (conocidas.add(d.getPalabra())) {
                /* Van a PENDIENTE aunque ya estuvieran curadas: es lo que el usuario pidió
                   explícitamente — quiere volver a verlas todas.

                   ⚠️ El precio es que la sección de Palabras y los ejercicios del Curso que
                   leen del diccionario se quedan SIN MATERIAL hasta que se aprueben. Está
                   aceptado a sabiendas: hay margen antes de publicar. */
                nuevas.add(PalabraRevision.builder()
                        .palabra(d.getPalabra())
                        .estado(EstadoRevision.PENDIENTE)
                        /* Sin rango real: el diccionario nunca guardó la frecuencia. Se usa el
                           largo como desempate flojo para que al menos las cortas —que son las
                           más comunes— salgan primero. */
                        .rangoFrecuencia(d.getLongitud() == null ? 99 : d.getLongitud())
                        .sospecha(FiltroPalabra.sospecha(d.getPalabra()))
                        .build());
            }
        }
        revisionRepository.saveAll(nuevas);

        /* El diccionario se vacía: si quedaran, la web mostraría palabras que todavía no
           pasaron el filtro y la revisión no significaría nada.

           Los hijos PRIMERO. La relación es un @ManyToOne unidireccional y la clave foránea
           está en NO ACTION, así que un deleteAll() sobre el padre revienta con una violación
           de integridad referencial — no hay ninguna cascada que los arrastre. */
        ngramRepository.borrarTodos();
        diccionarioRepository.deleteAll();

        String detalle = String.format(
                "%d palabras del diccionario pasaron a revisión. El diccionario quedó vacío.",
                nuevas.size());
        log.info(detalle);
        return resumenCon(detalle);
    }

    @Override
    public List<PalabraRevisionDTO> siguienteTanda(int cuantas) {
        return revisionRepository
                .findByEstadoOrderByRangoFrecuenciaAsc(EstadoRevision.PENDIENTE, Limit.of(cuantas))
                .stream().map(this::aDTO).toList();
    }

    @Override
    @Transactional
    public ResumenRevisionResponse guardarTanda(List<Integer> aprobadas, List<Integer> mostradas) {
        if (mostradas == null || mostradas.isEmpty()) {
            throw new ApiException("La tanda llegó vacía.");
        }
        Set<Integer> ok = new HashSet<>(aprobadas == null ? List.of() : aprobadas);
        int lote = revisionRepository.ultimoLote() + 1;

        List<PalabraRevision> filas = revisionRepository.findAllById(mostradas);
        for (PalabraRevision p : filas) {
            /* Solo se tocan las que seguían pendientes. Si una tanda se guarda dos veces —un
               doble clic, una recarga— la segunda no puede pisar decisiones ya tomadas. */
            if (p.getEstado() != EstadoRevision.PENDIENTE) {
                continue;
            }
            p.setEstado(ok.contains(p.getId()) ? EstadoRevision.PREACTIVA : EstadoRevision.NO_PERMITIDA);
            p.setLote(lote);
        }
        revisionRepository.saveAll(filas);

        String detalle = String.format("Tanda %d guardada: %d aprobadas, %d rechazadas.",
                lote, ok.size(), filas.size() - ok.size());
        log.info(detalle);
        return resumenCon(detalle);
    }

    @Override
    @Transactional
    public ResumenRevisionResponse activarPreactivas() {
        /* En orden de frecuencia: así los ids del diccionario quedan alineados con el
           ranking. Las consultas ya no dependen del id, pero una tabla donde el orden físico
           coincide con el lógico es mucho más fácil de mirar a mano. */
        List<PalabraRevision> listas =
                revisionRepository.findByEstadoOrderByRangoFrecuenciaAsc(EstadoRevision.PREACTIVA);
        if (listas.isEmpty()) {
            return resumenCon("No hay palabras pre-activas para activar.");
        }

        /* Recién ACÁ se generan los n-gramas, no al importar. Cada palabra produce ~10.6
           filas hijas: generarlos para las 50.000 de la antesala serían ~530.000 filas de
           palabras que quizá nunca se activen. */
        for (PalabraRevision p : listas) {
            dictionaryService.agregarPalabra(p.getPalabra(), p.getRangoFrecuencia());
        }

        /* Las activadas se quedan en la tabla con estado PREACTIVA a propósito: son el
           registro de qué se aprobó y cuándo, y además siguen bloqueando que una importación
           futura las vuelva a proponer. */
        String detalle = String.format("%d palabras activadas y visibles en la web.", listas.size());
        log.info(detalle);
        return resumenCon(detalle);
    }

    @Override
    @Transactional
    public ResumenRevisionResponse deshacerUltimaTanda() {
        int lote = revisionRepository.ultimoLote();
        if (lote == 0) {
            return resumenCon("No hay ninguna tanda que deshacer.");
        }
        List<PalabraRevision> filas = revisionRepository.findByLote(lote);
        for (PalabraRevision p : filas) {
            p.setEstado(EstadoRevision.PENDIENTE);
            p.setLote(null);
            p.setMotivoRechazo(null);
        }
        revisionRepository.saveAll(filas);

        String detalle = String.format("Tanda %d deshecha: %d palabras volvieron a pendientes.",
                lote, filas.size());
        log.info(detalle);
        return resumenCon(detalle);
    }

    @Override
    public BusquedaPalabrasResponse buscar(String texto) {
        if (texto == null || texto.isBlank()) {
            return new BusquedaPalabrasResponse(List.of(), List.of(), false);
        }

        List<String> terminos = terminosDe(texto);

        /* UN término: prefijo. Es el modo de siempre y el que sirve para explorar —barrer una
           familia, encontrar dónde quedó algo que se cree mal clasificado. */
        if (terminos.size() <= 1) {
            List<PalabraRevisionDTO> hallados = revisionRepository
                    .buscarPorPrefijo(terminos.get(0), Limit.of(TOPE_BUSQUEDA_PREFIJO))
                    .stream().map(this::aDTO).toList();
            return new BusquedaPalabrasResponse(hallados, List.of(), false);
        }

        /* VARIOS términos: exacto. `palabra` es UNIQUE, así que cada término trae como mucho
           una fila y no hace falta ningún tope: el resultado nunca puede pasar de lo pedido. */
        Map<String, PalabraRevision> porPalabra = revisionRepository
                .findByPalabraInOrderByRangoFrecuenciaAsc(terminos).stream()
                .collect(java.util.stream.Collectors.toMap(
                        PalabraRevision::getPalabra, Function.identity(), (a, b) -> a));

        /* Se recorre la lista del usuario y no la de la base para que el resultado salga en el
           orden en que él la escribió: así puede comparar contra lo que pegó de un vistazo. */
        List<PalabraRevisionDTO> hallados = new ArrayList<>();
        List<String> faltantes = new ArrayList<>();
        for (String t : terminos) {
            PalabraRevision p = porPalabra.get(t);
            if (p != null) {
                hallados.add(aDTO(p));
            } else {
                faltantes.add(t);
            }
        }
        return new BusquedaPalabrasResponse(hallados, faltantes, true);
    }

    /* Separa por espacios, normaliza y quita repetidas conservando el orden de escritura.
       LinkedHashSet y no HashSet: pegar una lista con una palabra dos veces no debería
       reordenar el resultado entero. */
    private List<String> terminosDe(String texto) {
        Set<String> vistos = new LinkedHashSet<>();
        for (String t : SEPARADOR.split(texto.trim().toLowerCase(Locale.ROOT))) {
            if (!t.isBlank() && t.length() <= LARGO_MAXIMO_PALABRA) {
                vistos.add(t);
            }
        }
        return vistos.stream().limit(TOPE_TERMINOS).toList();
    }

    @Override
    @Transactional
    public PalabraRevisionDTO cambiarEstado(Integer id, String nuevoEstado) {
        PalabraRevision p = revisionRepository.findById(id)
                .orElseThrow(() -> new ApiException("No existe la palabra con id " + id));

        EstadoRevision destino;
        try {
            destino = EstadoRevision.valueOf(nuevoEstado.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ApiException("Estado no reconocido: " + nuevoEstado);
        }

        if (destino == EstadoRevision.NO_PERMITIDA) {
            sacarDeCirculacion(p);
        }

        p.setEstado(destino);
        revisionRepository.save(p);
        log.info("Palabra [{}] movida a {}", p.getPalabra(), destino);
        return aDTO(p);
    }

    /* Si la palabra ya estaba viva en la web y se la saca de circulación, hay que borrarla del
       diccionario además de cambiarle el estado — si no, seguiría apareciendo en los ejercicios
       con la etiqueta de rechazada. Los hijos primero: `diccionario_ngrams` cuelga de un
       @ManyToOne unidireccional con la clave foránea en NO ACTION, o sea que no hay cascada y
       borrar el padre solo reventaría con violación de integridad referencial. */
    private void sacarDeCirculacion(PalabraRevision p) {
        diccionarioRepository.findByPalabra(p.getPalabra()).ifPresent(d -> {
            ngramRepository.borrarPorPalabra(d.getId());
            diccionarioRepository.delete(d);
        });
    }

    @Override
    @Transactional
    public ResumenRevisionResponse cambiarEstadoLote(List<Integer> ids, List<String> nuevas,
                                                     String estado) {
        List<Integer> idsSeguros = ids == null ? List.of() : ids;
        List<String> nuevasSeguras = nuevas == null ? List.of() : nuevas;
        if (idsSeguros.isEmpty() && nuevasSeguras.isEmpty()) {
            throw new ApiException("No hay ninguna palabra que mover.");
        }

        EstadoRevision destino;
        try {
            destino = EstadoRevision.valueOf(estado.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ApiException("Estado no reconocido: " + estado);
        }

        /* Crear palabras solo tiene sentido hacia el cajón de rechazadas. Darlas de alta como
           pendientes o pre-activas sería inventar entradas que no salieron de ningún corpus y
           que no tienen rango de frecuencia: aparecerían primeras en la cola de revisión (el
           rango 0 ordena antes que todo) prometiendo ser las palabras más comunes del idioma. */
        if (!nuevasSeguras.isEmpty() && destino != EstadoRevision.NO_PERMITIDA) {
            throw new ApiException(
                    "Solo se pueden crear palabras nuevas al mandarlas a no permitidas.");
        }

        int movidas = 0;
        for (PalabraRevision p : revisionRepository.findAllById(idsSeguros)) {
            if (destino == EstadoRevision.NO_PERMITIDA) {
                sacarDeCirculacion(p);
            }
            p.setEstado(destino);
            revisionRepository.save(p);
            movidas++;
        }

        /* Se relee la tabla en vez de confiar en que la búsqueda siga vigente: entre que el
           usuario buscó y hizo clic pudo importarse un archivo, o pudo tener dos pestañas
           abiertas. Sin esto, un INSERT chocaría contra el índice único de `palabra`. */
        Set<String> yaExisten = new HashSet<>(revisionRepository.todasLasPalabras());
        int creadas = 0;
        for (String palabra : nuevasSeguras) {
            String limpia = palabra == null ? "" : palabra.trim().toLowerCase(Locale.ROOT);
            /* La comprobación de espacios es un cinturón de seguridad, no una validación de
               entrada: los términos ya vienen separados. Existe porque un fallo de escape en el
               separador creó siete filas con un salto de línea adentro, y una fila así no se
               puede escribir a mano en la pantalla ni se detecta mirando la tabla. */
            if (limpia.isBlank() || limpia.length() > LARGO_MAXIMO_PALABRA
                    || SEPARADOR.matcher(limpia).find() || !yaExisten.add(limpia)) {
                continue;
            }
            PalabraRevision nueva = new PalabraRevision();
            nueva.setPalabra(limpia);
            nueva.setEstado(EstadoRevision.NO_PERMITIDA);
            /* Rango 0 = "sin dato de frecuencia", que es la verdad: esta palabra no vino de un
               corpus, la escribió una persona. Es el mismo convenio que usa el diccionario,
               donde ORDEN_FRECUENCIA manda los ceros al final con COALESCE(NULLIF(...)). */
            nueva.setRangoFrecuencia(0);
            nueva.setMotivoRechazo("agregada a mano");
            /* Sin lote a propósito: "deshacer última tanda" devuelve a PENDIENTE todo lo que
               comparta número de lote, y estas palabras no salieron de una tanda. Meterlas ahí
               haría que un deshacer las resucitara justo cuando su razón de existir es no
               volver a aparecer nunca. */
            revisionRepository.save(nueva);
            creadas++;
        }

        String detalle = "%d movidas a %s, %d creadas como no permitidas"
                .formatted(movidas, destino, creadas);
        log.info("Lote de revisión: {}", detalle);
        return resumenCon(detalle);
    }

    @Override
    public ResumenRevisionResponse resumen() {
        return resumenCon(null);
    }

    private ResumenRevisionResponse resumenCon(String detalle) {
        return ResumenRevisionResponse.builder()
                .pendientes(revisionRepository.countByEstado(EstadoRevision.PENDIENTE))
                .preactivas(revisionRepository.countByEstado(EstadoRevision.PREACTIVA))
                .noPermitidas(revisionRepository.countByEstado(EstadoRevision.NO_PERMITIDA))
                .enDiccionario(diccionarioRepository.count())
                .detalle(detalle)
                .build();
    }

    private PalabraRevisionDTO aDTO(PalabraRevision p) {
        return PalabraRevisionDTO.builder()
                .id(p.getId())
                .palabra(p.getPalabra())
                .estado(p.getEstado().name())
                .rangoFrecuencia(p.getRangoFrecuencia())
                .sospecha(p.getSospecha())
                .build();
    }
}
