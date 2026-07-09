export function detectInputKind(fileName: string, url: string, fileType: string) {
  if (url && /youtu\.be|youtube\.com/i.test(url)) return 'YouTube';
  if (url) return 'Web';
  if (/\.pdf$/i.test(fileName) || /pdf/i.test(fileType)) return 'PDF';
  if (/image\//i.test(fileType) || /\.(png|jpg|jpeg|webp)$/i.test(fileName)) return 'Imagen';
  return 'Texto';
}

export function describeInput(inputKind: string) {
  switch (inputKind) {
    case 'PDF':
      return { noun: 'documento PDF', phrase: 'el documento PDF' };
    case 'Imagen':
      return { noun: 'imagen', phrase: 'la imagen' };
    case 'Web':
      return { noun: 'página web', phrase: 'la página web' };
    case 'YouTube':
      return { noun: 'video de YouTube', phrase: 'el video de YouTube' };
    default:
      return { noun: 'texto ingresado', phrase: 'el texto ingresado' };
  }
}

export function getInputTypeLabel(inputKind: string) {
  switch (inputKind) {
    case 'PDF':
      return 'Documento PDF';
    case 'Imagen':
      return 'Imagen';
    case 'Web':
      return 'Página web';
    case 'YouTube':
      return 'Video de YouTube';
    default:
      return 'Texto';
  }
}
