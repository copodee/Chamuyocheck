export async function extractImageTextPlaceholder(fileName: string, size: number) {
  return {
    ok: false,
    text: '',
    note: `Imagen recibida: ${fileName} (${size} bytes). OCR real preparado para integración en backend externo o servicio OCR.`,
  };
}
