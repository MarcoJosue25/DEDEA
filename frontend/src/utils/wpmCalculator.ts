// Espejo exacto de WpmCalculator.java
// Fórmula estándar internacional: (caracteres correctos / 5) / minutos

export const calcularWpm = (caracteresCorrectos: number, duracionSegundos: number): number => {
  if (duracionSegundos <= 0 || caracteresCorrectos <= 0) return 0;
  const minutos = duracionSegundos / 60;
  const palabrasEstandar = caracteresCorrectos / 5;
  return Math.round(palabrasEstandar / minutos);
};

export const calcularPrecision = (
  teclasCorrectas: number,
  totalTeclasPresionadas: number
): number => {
  if (totalTeclasPresionadas <= 0 || teclasCorrectas <= 0) return 0;
  const precision = (teclasCorrectas / totalTeclasPresionadas) * 100;
  return Math.min(100, Math.round(precision * 100) / 100);
};