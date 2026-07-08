export function extractEvidenceSignals(text: string) {
  const urls = text.match(/https?:\/\/\S+/g) || [];
  const money = text.match(/\$\s?[0-9\.]+/g) || [];
  const percents = text.match(/[0-9]+(?:,[0-9]+|\.[0-9]+)?\s?%/g) || [];
  const dates = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b20\d{2}\b/g) || [];
  const strongClaims = text.match(/garantizad[oa]s?|sin riesgo|sin esfuerzo|100%|comprobado|millonario|cura|definitivo/gi) || [];

  return {
    urls: urls.length,
    money: money.length,
    percents: percents.length,
    dates: dates.length,
    strongClaims: strongClaims.length,
    signals: [
      urls.length ? `${urls.length} enlaces visibles` : 'No se observan enlaces visibles',
      money.length ? `${money.length} montos detectados` : 'No se observan montos relevantes',
      percents.length ? `${percents.length} porcentajes detectados` : 'No se observan porcentajes relevantes',
      dates.length ? `${dates.length} fechas o años detectados` : 'No se observan fechas claras',
      strongClaims.length ? `${strongClaims.length} afirmaciones fuertes o absolutas` : 'No se detectan afirmaciones absolutas dominantes'
    ]
  };
}
