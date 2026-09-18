import {
  CORRECTO, ERROR, FINALES, RACHA, TECLEO,
  type Candidato, type FamiliaFinal, type Grado,
} from './catalogo';
import { ESQUEMAS, type Esquema, type UnidadRacha } from './hitos';
import { ponerVolumen, VOLUMEN_POR_DEFECTO } from './sintesis';

/* QUÉ SUENA — la configuración de sonido de la app.

   catalogo.ts es el MENÚ (44 sonidos y 11 familias de cierre); este archivo es la CARTA:
   cuál de todos suena, cómo se combinan y si el sonido está encendido. Los ejercicios no
   importan el catálogo, importan las cinco funciones `tocar*` de abajo — así el día que el
   usuario cambie un sonido desde su perfil no hay que tocar ninguna vista.

   ELECCIÓN DEL USUARIO (7-sep-2026), tras oírlos en /laboratorio-sonido:

     tecleo    barra de tipos    fallo    martillo      resultado   cristal
     acierto   marimba           racha    campanas

   ⚠️ LOS DEMÁS NO SE BORRAN. El plan de la sección 14 era quedarse con los ganadores y tirar
   el resto; el usuario decidió lo contrario, y por eso las cuatro listas del catálogo siguen
   enteras: son las opciones que va a poder elegir desde su perfil más adelante. Lo de aquí
   son los VALORES POR DEFECTO, no la única posibilidad — de ahí que todo esto sea un objeto
   que se lee y se guarda, y no cinco constantes sueltas. */

export type ModoTecleo = 'tecleo-fallo' | 'solo-tecleo' | 'por-resultado' | 'base-mas-acento';

/* Cómo se combinan los tres sonidos de pulsación. Vive aquí y no en la vista del laboratorio
   porque es configuración de producto: decide cuáles de los sonidos elegidos llegan a
   sonar. En 'tecleo-fallo', por ejemplo, el de acierto no suena NUNCA. */
export const MODOS: { id: ModoTecleo; nombre: string; predeterminado?: boolean; nota: string }[] = [
  {
    id: 'base-mas-acento',
    nombre: 'Base + acento',
    predeterminado: true,
    nota: 'El tecleo siempre, y encima el acierto o el fallo. Es el más rico y el más denso, '
      + 'y es el único modo en el que suenan los tres sonidos elegidos.',
  },
  {
    id: 'tecleo-fallo',
    nombre: 'Tecleo + fallo',
    nota: 'El clic neutro en todas, y encima el aviso solo cuando fallas. El acierto no suena '
      + 'aparte: el premio por hacerlo bien es la racha. Es la alternativa si «Base + acento» '
      + 'termina cansando (ver el aviso de la marimba más abajo).',
  },
  {
    id: 'solo-tecleo',
    nombre: 'Solo tecleo',
    nota: 'Un único sonido por tecla. El error no suena: lo dice el color del texto.',
  },
  {
    id: 'por-resultado',
    nombre: 'Por resultado',
    nota: 'Acierto y fallo suenan distinto. No hay sonido neutro de tecleo.',
  },
];

export interface PreferenciasSonido {
  /* Encendido o apagado. Es lo que la sección 14.7 pedía antes de publicar: sonido que no se
     puede apagar no es opción. Arranca ENCENDIDO — un sonido elegido a mano y apagado por
     defecto no lo oiría nadie— y esa es la única de estas líneas que conviene reconfirmar
     antes de publicar, porque afecta al primer segundo de la primera visita. */
  activo: boolean;
  volumen: number;
  modo: ModoTecleo;
  tecleo: string;
  correcto: string;
  error: string;
  racha: string;
  final: string;
  /* La racha cuenta LETRAS: a cinco pulsaciones por segundo el cartel puede aparecer con un
     10 y seguir subiendo mientras se desvanece, que es lo que se pidió. Contando palabras el
     número se queda clavado (ver hitos.ts). */
  unidad: UnidadRacha;
  esquemaId: string;
  avisoMs: number;
}

/* ⚠️ EL USUARIO ELIGIÓ LOS CINCO SONIDOS, NO EL RESTO DE ESTA TABLA. `modo`, `esquemaId` y
   `avisoMs` son el valor mejor fundado de cada uno según lo que documentan MODOS, hitos.ts y
   AvisoRacha, y siguen abiertos:

     · modo = base-mas-acento porque es el único donde suenan los tres sonidos elegidos. Si
       se dejara en 'tecleo-fallo' —lo que se venía recomendando— la marimba no sonaría
       jamás y elegirla no habría servido de nada.
     · esquemaId = l15 (15 · 30 · 45) y no l10, cuyo propio texto dice que es «el que antes
       cansa»: con hitos cada diez letras el premio suena tres veces por frase.
     · avisoMs = 1600, el punto medio del rango de 1 a 2 s que documenta AvisoRacha. */
export const PREDETERMINADAS: PreferenciasSonido = {
  activo: true,
  volumen: VOLUMEN_POR_DEFECTO,
  modo: 'base-mas-acento',
  tecleo: 'barra',
  correcto: 'marimba',
  error: 'martillo',
  racha: 'campanas',
  final: 'cristal-fin',
  unidad: 'letras',
  esquemaId: 'l15',
  avisoMs: 1600,
};

const CLAVE = 'dedea_sonido';

/* El evento propio, igual que `dedea:apariencia`. El `storage` del navegador solo se dispara
   en OTRAS pestañas, así que sin esto la pantalla que cambia una preferencia es justamente la
   única que no se entera. */
export const EVENTO_SONIDO = 'dedea:sonido';

let cache: PreferenciasSonido | null = null;

/* Un id que ya no exista en el catálogo cae al predeterminado en vez de dejar la familia
   muda. Pasa solo, sin que nadie se equivoque: basta con renombrar un candidato mientras
   alguien tenía el viejo guardado en su navegador. */
const sanear = (guardado: Partial<PreferenciasSonido>): PreferenciasSonido => {
  const existe = (lista: { id: string }[], id: unknown, porDefecto: string) =>
    (typeof id === 'string' && lista.some((c) => c.id === id)) ? id : porDefecto;

  const unidad: UnidadRacha = guardado.unidad === 'palabras' ? 'palabras' : 'letras';
  return {
    activo: typeof guardado.activo === 'boolean' ? guardado.activo : PREDETERMINADAS.activo,
    volumen: typeof guardado.volumen === 'number'
      ? Math.max(0, Math.min(1, guardado.volumen)) : PREDETERMINADAS.volumen,
    modo: existe(MODOS, guardado.modo, PREDETERMINADAS.modo) as ModoTecleo,
    tecleo: existe(TECLEO, guardado.tecleo, PREDETERMINADAS.tecleo),
    correcto: existe(CORRECTO, guardado.correcto, PREDETERMINADAS.correcto),
    error: existe(ERROR, guardado.error, PREDETERMINADAS.error),
    racha: existe(RACHA, guardado.racha, PREDETERMINADAS.racha),
    final: existe(FINALES, guardado.final, PREDETERMINADAS.final),
    unidad,
    // El esquema depende de la unidad: los de letras no existen contando palabras.
    esquemaId: existe(ESQUEMAS[unidad], guardado.esquemaId,
      unidad === PREDETERMINADAS.unidad ? PREDETERMINADAS.esquemaId : ESQUEMAS[unidad][0].id),
    avisoMs: typeof guardado.avisoMs === 'number'
      ? guardado.avisoMs : PREDETERMINADAS.avisoMs,
  };
};

export const leerPreferencias = (): PreferenciasSonido => {
  if (cache) return cache;
  try {
    const crudo = localStorage.getItem(CLAVE);
    cache = crudo ? sanear(JSON.parse(crudo) as Partial<PreferenciasSonido>) : { ...PREDETERMINADAS };
  } catch {
    // localStorage puede fallar entero (modo privado, datos bloqueados): con los valores por
    // defecto la app suena igual, solo que sin recordar nada.
    cache = { ...PREDETERMINADAS };
  }
  return cache;
};

export const guardarPreferencias = (cambios: Partial<PreferenciasSonido>) => {
  cache = sanear({ ...leerPreferencias(), ...cambios });
  try {
    localStorage.setItem(CLAVE, JSON.stringify(cache));
  } catch {
    // Se pierde al recargar, pero la sesión en curso ya quedó con el cambio aplicado.
  }
  ponerVolumen(cache.volumen);
  window.dispatchEvent(new CustomEvent(EVENTO_SONIDO));
};

/* ---------- Lo que llaman los ejercicios ----------

   Cinco funciones y ninguna decisión: quién suena, en qué modo y si el sonido está encendido
   se resuelve aquí dentro. Una vista que quiera sonar llama a `tocarPulsacion(acierto)` y no
   necesita saber nada más. */

const buscar = <T extends { id: string }>(lista: T[], id: string, porDefecto: string): T =>
  lista.find((c) => c.id === id) ?? (lista.find((c) => c.id === porDefecto) as T);

const candidatoTecleo = (p: PreferenciasSonido): Candidato =>
  buscar(TECLEO, p.tecleo, PREDETERMINADAS.tecleo);
const candidatoCorrecto = (p: PreferenciasSonido): Candidato =>
  buscar(CORRECTO, p.correcto, PREDETERMINADAS.correcto);
const candidatoError = (p: PreferenciasSonido): Candidato =>
  buscar(ERROR, p.error, PREDETERMINADAS.error);
const candidatoRacha = (p: PreferenciasSonido): Candidato =>
  buscar(RACHA, p.racha, PREDETERMINADAS.racha);
const candidatoFinal = (p: PreferenciasSonido): FamiliaFinal =>
  buscar(FINALES, p.final, PREDETERMINADAS.final);

/* Una pulsación. El modo decide qué se oye, y por eso es UNA función y no dos: si cada vista
   resolviera el modo por su cuenta, los cuatro modos habría que escribirlos en cinco sitios.

   ⚠️ Se llama en CADA tecla, así que no puede hacer nada caro: leer las preferencias es un
   objeto en memoria (`cache`) y no una lectura de localStorage. */
export const tocarPulsacion = (acierto: boolean) => {
  const p = leerPreferencias();
  if (!p.activo) return;
  switch (p.modo) {
    case 'solo-tecleo':
      candidatoTecleo(p).tocar();
      break;
    case 'tecleo-fallo':
      candidatoTecleo(p).tocar();
      if (!acierto) candidatoError(p).tocar();
      break;
    case 'por-resultado':
      (acierto ? candidatoCorrecto(p) : candidatoError(p)).tocar();
      break;
    default:
      candidatoTecleo(p).tocar();
      (acierto ? candidatoCorrecto(p) : candidatoError(p)).tocar();
  }
};

/* El hito de racha. `escalon` es el número de premio (0 el primero), no la racha: es lo que
   sube el tono dos semitonos en cada hito. Sale de escalonDeHito (hitos.ts). */
export const tocarRacha = (escalon: number) => {
  const p = leerPreferencias();
  if (!p.activo) return;
  candidatoRacha(p).tocar(escalon);
};

export const tocarFinal = (grado: Grado) => {
  const p = leerPreferencias();
  if (!p.activo) return;
  candidatoFinal(p).tocar(grado);
};

// El esquema de hitos vigente, para que la vista no tenga que cruzar unidad e id a mano.
export const esquemaVigente = (): Esquema => {
  const p = leerPreferencias();
  return ESQUEMAS[p.unidad].find((e) => e.id === p.esquemaId) ?? ESQUEMAS[p.unidad][0];
};
