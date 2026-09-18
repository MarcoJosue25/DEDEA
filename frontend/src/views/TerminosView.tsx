import PaginaLegal from '../components/legal/PaginaLegal';
import { CORREO_CONTACTO } from '../core/contacto';

const TerminosView = () => {
  return (
    <PaginaLegal
      titulo="Términos de uso"
      actualizada="18 de septiembre de 2026"
      secciones={[
        {
          titulo: 'El servicio',
          contenido: (
            <p>
              DEDEA es una plataforma gratuita para practicar mecanografía. Al usarla aceptas
              estos términos.
            </p>
          ),
        },
        {
          titulo: 'Uso aceptable',
          contenido: (
            <p>
              No intentes dañar el servicio, sobrecargarlo con peticiones automáticas ni acceder
              a los datos de otras personas.
            </p>
          ),
        },
        {
          /* La sección que más importa de esta página: los textos con IA no tienen verdad de
             referencia y pueden inventar datos, y el usuario los lee mientras teclea (ver
             ICEBOX, "Los textos de IA afirman cosas falsas con tono de autoridad"). */
          titulo: 'El contenido',
          contenido: (
            <p>
              Los textos generados con inteligencia artificial y los resúmenes de noticias se
              crean de forma automática y pueden contener errores o datos inexactos: son
              material de práctica, no una fuente de información. Las noticias originales
              pertenecen a sus medios.
            </p>
          ),
        },
        {
          titulo: 'Tu cuenta',
          contenido: (
            <p>
              Puedes dejar de usar DEDEA cuando quieras y pedir que eliminemos tu cuenta
              escribiendo a <a href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a>. Cómo
              tratamos tus datos está en la Política de privacidad, enlazada al pie de la página.
            </p>
          ),
        },
        {
          titulo: 'Disponibilidad',
          contenido: (
            <p>
              Hacemos lo posible por que DEDEA funcione bien, pero no podemos garantizar que esté
              siempre disponible ni libre de errores. Sus funciones pueden cambiar con el tiempo.
            </p>
          ),
        },
        {
          titulo: 'Cambios',
          contenido: (
            <p>
              Podemos actualizar estos términos. La fecha de arriba indica la versión vigente.
            </p>
          ),
        },
      ]}
    />
  );
};

export default TerminosView;
