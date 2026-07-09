export function buildRecommendations(text: string, topic: string | undefined, inputKind: string) {
  const recommendations = new Set<string>();

  recommendations.add('Pedí la fuente original, la fecha de publicación y el contexto del contenido.');
  recommendations.add('Buscá evidencia verificable, no solo frases o resúmenes.');

  if (/https?:\/\/|fuente|fuentes|informe|estudio|metodolog/i.test(text)) {
    recommendations.add('Verificá si el texto expone metodología, fuente primaria o respaldo documental.');
  }

  if (topic === 'finance' || /pr[eé]stamo|cr[eé]dito|cft|tea|tna|comisi[oó]n|seguro/i.test(text)) {
    recommendations.add('Pedí el costo total, tasas, cargos y condiciones completas antes de decidir.');
  }

  if (topic === 'employment' || /vacante|postulaci[oó]n|oferta laboral|sueldo/i.test(text)) {
    recommendations.add('Pedí detalles del puesto, la empresa y la base real de la oferta.');
  }

  if (topic === 'academic' || /tesis|universidad|bibliograf|chatgpt/i.test(text)) {
    recommendations.add('Pedí fuentes, borradores o una defensa metodológica antes de concluir sobre autoría o IA.');
  }

  if (inputKind === 'PDF') {
    recommendations.add('Contrastá el resumen con el documento completo si se trata de un PDF.');
  }

  return Array.from(recommendations).slice(0, 6);
}
