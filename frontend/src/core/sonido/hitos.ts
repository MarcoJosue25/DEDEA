/* LOS HITOS DE LA RACHA.

   QUÉ SE CUENTA: letras o palabras. No es un detalle de ajuste, cambia el efecto entero.

     · LETRAS — a cinco o seis pulsaciones por segundo, la racha corre. Es la única forma de
       que el cartel del hito haga lo que se le pidió: aparecer con un 10 y seguir subiendo
       a 11, 12, 13... mientras se desvanece. Contando palabras eso casi nunca pasa, porque
       en el segundo y medio que dura el aviso no da tiempo a cerrar tres palabras más.
     · PALABRAS — la racha vale mucho más y por eso avanza mucho más despacio. El número del
       cartel se queda casi quieto, y el premio se parece más a un logro que a un contador.

   Y de ahí sale que cada unidad necesite SUS PROPIOS ESCALONES: diez letras se escriben en
   dos segundos, así que un hito cada diez letras suena tres veces por frase. Por eso la
   opción de 25 · 50 · 75, que en letras equivale más o menos a lo que 10 · 20 · 30 significa
   en palabras. */
export type UnidadRacha = 'letras' | 'palabras';

export const UNIDADES: { id: UnidadRacha; nombre: string; nota: string }[] = [
  {
    id: 'letras',
    nombre: 'Letras',
    nota: 'El contador corre: el cartel aparece en 10 y sigue subiendo mientras se desvanece.',
  },
  {
    id: 'palabras',
    nombre: 'Palabras',
    nota: 'Cuesta más y vale más, pero el número del cartel apenas se mueve antes de irse.',
  },
];

export interface Esquema {
  id: string;
  nombre: string;
  nota: string;
  /* El primer hito y la distancia entre los siguientes. Se separan porque 5 · 15 · 25 no es
     una progresión regular: adelanta el primer premio y después vuelve al paso de diez. */
  primero: number;
  paso: number;
}

export const ESQUEMAS: Record<UnidadRacha, Esquema[]> = {
  letras: [
    {
      id: 'l10',
      nombre: '10 · 20 · 30',
      nota: 'Premio cada dos segundos largos. Es el que más se nota y el que antes cansa.',
      primero: 10,
      paso: 10,
    },
    {
      id: 'l25',
      nombre: '25 · 50 · 75',
      nota: 'Un hito por frase, más o menos. En letras equivale a lo que 10 · 20 · 30 vale '
        + 'contando palabras.',
      primero: 25,
      paso: 25,
    },
    {
      id: 'l15',
      nombre: '15 · 30 · 45',
      nota: 'El término medio: llega pronto sin sonar a cada renglón.',
      primero: 15,
      paso: 15,
    },
  ],
  palabras: [
    {
      id: 'p10',
      nombre: '10 · 20 · 30',
      nota: 'El primer premio cuesta; los siguientes van de diez en diez.',
      primero: 10,
      paso: 10,
    },
    {
      id: 'p5',
      nombre: '5 · 15 · 25',
      nota: 'El primero llega pronto y engancha antes; el escalón sigue siendo de diez.',
      primero: 5,
      paso: 10,
    },
  ],
};

/* Devuelve el ESCALÓN del hito (0 el primero, 1 el segundo...) si esta racha es justo un
   hito, y null si no lo es. El escalón es lo que hace subir de tono el sonido de racha, así
   que tiene que ser el número de premio y no el número de aciertos. */
export const escalonDeHito = (racha: number, e: Esquema): number | null => {
  if (racha < e.primero) return null;
  if ((racha - e.primero) % e.paso !== 0) return null;
  return (racha - e.primero) / e.paso;
};
