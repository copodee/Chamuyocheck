export function classifyDocument(text: string, input: string, fileName = '') {
  const t = `${text} ${fileName}`.toLowerCase();

  if (/tesis|monograf|trabajo pr|facultad|universidad|colegio|alumno|docente|bibliograf|ensayo|conclusi[oó]n|introducci[oó]n|marco te[oó]rico|abstract|referencias/.test(t)) {
    return { icon: '🎓', type: 'Trabajo académico', focus: 'Posible uso de IA / calidad académica' };
  }
  if (/nota|comunicado|period[ií]stic|diario|fuentes cercanas|redacci[oó]n|entrevist/.test(t)) {
    return { icon: '📰', type: 'Nota o artículo periodístico', focus: 'Veracidad, fuentes y posible redacción asistida' };
  }
  if (/contrato|cl[aá]usula|locaci[oó]n|compraventa|mutuo|leasing|t[eé]rminos|condiciones/.test(t)) {
    return { icon: '📑', type: 'Contrato o documento legal', focus: 'Cláusulas, riesgos y faltantes' };
  }
  if (/pr[eé]stamo|cuota|cft|tea|tna|cr[eé]dito|financiaci[oó]n|inter[eé]s|\$/.test(t)) {
    return { icon: '💳', type: 'Oferta financiera', focus: 'Costo real, CFT y cargos omitidos' };
  }
  if (/referido|referidos|multinivel|ponzi|pir[aá]mid|ingresos pasivos|rentabilidad garantizada/.test(t)) {
    return { icon: '🕸️', type: 'Oferta de inversión o referidos', focus: 'Riesgo piramidal / promesas' };
  }
  if (/medicamento|salud|m[eé]dico|cura|tratamiento|suplemento|c[aá]ncer|dolor/.test(t)) {
    return { icon: '⚕️', type: 'Contenido de salud', focus: 'Respaldo médico y advertencias' };
  }
  if (input === 'PDF') return { icon: '📄', type: 'Documento PDF', focus: 'Clasificación documental basada en texto extraído' };
  if (input === 'Imagen') return { icon: '🖼️', type: 'Imagen o captura', focus: 'Texto visible y señales de manipulación' };
  if (input === 'Web') return { icon: '🌐', type: 'Página web', focus: 'Credibilidad online' };
  if (input === 'YouTube') return { icon: '▶️', type: 'Video de YouTube', focus: 'Promesas y evidencia del contenido' };

  return { icon: '📝', type: 'Texto libre', focus: 'Credibilidad general' };
}
