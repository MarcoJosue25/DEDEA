import PaginaLegal from '../components/legal/PaginaLegal';
import { CORREO_CONTACTO } from '../core/contacto';

/* Cada afirmación de esta página describe lo que el código hace hoy: qué se guarda
   (modelos Sesion, SesionTeclaEvento y Usuario), qué recibe Gemini (solo las teclas y
   combinaciones débiles de TextoIaRequest), qué cookies existen (dedea_token y la de
   sesión del login OAuth) y qué terceros ve el navegador (Google Fonts en index.html y
   las imágenes de las noticias). Si algo de eso cambia, esta página tiene que cambiar. */
const PrivacidadView = () => (
  <PaginaLegal
    titulo="Política de privacidad"
    actualizada="18 de septiembre de 2026"
    secciones={[
      {
        titulo: 'Quiénes somos',
        contenido: (
          <p>
            DEDEA (dedea.org) es una plataforma para practicar mecanografía. Para cualquier
            consulta sobre tus datos escríbenos a{' '}
            <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a>.
          </p>
        ),
      },
      {
        titulo: 'Qué datos guardamos',
        contenido: (
          <ul>
            <li>
              <strong>Sin cuenta:</strong> un identificador aleatorio guardado en tu navegador y
              los resultados de tus prácticas: velocidad, precisión, duración, y qué teclas
              acertaste o fallaste y en cuánto tiempo.
            </li>
            <li>
              <strong>Si inicias sesión con Google o Facebook:</strong> además, tu correo, tu
              nombre y tu foto de perfil. Nunca vemos ni guardamos tu contraseña.
            </li>
          </ul>
        ),
      },
      {
        titulo: 'Para qué los usamos',
        contenido: (
          <p>
            Para mostrarte tus estadísticas y tu progreso, adaptar los ejercicios a las teclas
            que más te cuestan y mantener tu sesión iniciada. No vendemos tus datos ni mostramos
            publicidad.
          </p>
        ),
      },
      {
        titulo: 'Con quién se comparten',
        contenido: (
          <ul>
            <li>
              <strong>Google Gemini</strong> genera los textos de práctica con IA a partir de las
              letras y combinaciones que más te cuestan. No recibe tu nombre ni tu correo.
            </li>
            <li>
              <strong>Google o Facebook</strong>, solo si inicias sesión con ellos.
            </li>
            <li>
              Las fuentes tipográficas se cargan desde Google Fonts y las imágenes de las
              noticias desde los sitios de cada medio. Como en cualquier web, esos servicios
              reciben tu dirección IP al cargarlas.
            </li>
          </ul>
        ),
      },
      {
        titulo: 'Cookies',
        contenido: (
          <p>
            Usamos una cookie para mantener tu sesión iniciada (dura 30 días) y otra temporal
            mientras inicias sesión. En el almacenamiento de tu navegador guardamos tu
            identificador y tus preferencias, como la apariencia o el sonido. No usamos cookies
            de publicidad ni de analítica.
          </p>
        ),
      },
      {
        titulo: 'Tus derechos',
        contenido: (
          <p>
            Puedes pedir en cualquier momento ver tus datos, corregirlos o eliminarlos, incluida
            tu cuenta, escribiendo a <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a>.
            Son los derechos que te reconoce la Ley N.° 29733 de Protección de Datos Personales
            del Perú.
          </p>
        ),
      },
      {
        titulo: 'Cambios',
        contenido: <p>Si esta política cambia, lo verás en esta página con su nueva fecha.</p>,
      },
    ]}
  />
);

export default PrivacidadView;
