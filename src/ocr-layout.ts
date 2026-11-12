import Tesseract from 'tesseract.js';

// Tesseract 7 exposes boxes under blocks, and requires blocks output explicitly.
export function getLayout(page: Pick<Tesseract.Page, 'blocks'>) {
  const lines = (page.blocks ?? []).flatMap(block => block.paragraphs.flatMap(paragraph => paragraph.lines));
  return { lines, words: lines.flatMap(line => line.words) };
}

export async function recognizeLayout(
  image: Tesseract.ImageLike,
  logger: NonNullable<Tesseract.WorkerOptions['logger']>,
  createWorker: typeof Tesseract.createWorker = Tesseract.createWorker
) {
  const worker = await createWorker('jpn+eng', Tesseract.OEM.LSTM_ONLY, { logger });
  try {
    return await worker.recognize(image, {}, { blocks: true });
  } finally {
    await worker.terminate();
  }
}
