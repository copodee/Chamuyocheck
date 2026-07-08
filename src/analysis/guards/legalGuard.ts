const forbidden = [
  ['es una estafa', 'presenta indicadores que conviene verificar'],
  ['es fraude', 'presenta señales de riesgo que requieren verificación'],
  ['miente', 'no se observa evidencia suficiente en el contenido analizado'],
  ['es plagio', 'presenta señales que podrían requerir comparación adicional'],
  ['fue hecho con IA', 'presenta indicadores compatibles con asistencia de IA, no concluyentes'],
  ['es falso', 'no se cuenta con respaldo suficiente para confirmarlo'],
];

export function legalGuard(text: string): string {
  let safe = text || '';
  for (const [bad, replacement] of forbidden) {
    const re = new RegExp(bad, 'gi');
    safe = safe.replace(re, replacement);
  }
  return safe;
}
