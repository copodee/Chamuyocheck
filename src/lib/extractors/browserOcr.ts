export type BrowserOcrResult = {
  ok: boolean;
  text: string;
  confidence: number;
  note: string;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const BROWSER_OCR_TIMEOUT_MS = 35_000;

export async function extractImageTextInBrowser(file: File): Promise<BrowserOcrResult> {
  if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type) || file.size > MAX_IMAGE_BYTES) {
    return { ok: false, text: '', confidence: 0, note: 'La imagen debe ser PNG, JPG o WebP y pesar como máximo 10 MB.' };
  }
  const { createWorker, OEM, PSM } = await import('tesseract.js');
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    const operation = (async () => {
      worker = await createWorker('spa', OEM.LSTM_ONLY);
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
      return worker.recognize(file);
    })();
    const result = await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('OCR_TIMEOUT')), BROWSER_OCR_TIMEOUT_MS);
      }),
    ]);
    const text = String(result.data.text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    const confidence = Number(result.data.confidence || 0);
    return {
      ok: text.length >= 20,
      text,
      confidence,
      note: text.length >= 20
        ? `OCR local completado (${confidence.toFixed(0)}% de confianza estimada de lectura).`
        : 'La captura no produjo texto suficiente. Probá con una imagen más nítida y sin recortes.',
    };
  } catch (error) {
    return {
      ok: false,
      text: '',
      confidence: 0,
      note: error instanceof Error && error.message === 'OCR_TIMEOUT'
        ? 'La lectura de la captura superó 35 segundos. Probá con una imagen más recortada.'
        : 'No se pudo leer la captura en este dispositivo.',
    };
  } finally {
    if (timeout) clearTimeout(timeout);
    await Promise.race([
      worker?.terminate().catch(() => undefined) || Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 1_500)),
    ]);
  }
}
