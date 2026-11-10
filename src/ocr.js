import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { cleanOcrText } from './logic.js';

function score(result) {
  const text = cleanOcrText(result.data.text);
  const han = (text.match(/\p{Script=Han}/gu) ?? []).length;
  return { text, confidence: Math.round(result.data.confidence), rank: result.data.confidence + Math.min(han, 40) * 0.3 };
}

export async function recognizeDocument(bytes) {
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > 24_000_000) throw new Error('图片尺寸不支持');
  const worker = await createWorker('chi_sim+eng');
  let best;
  try {
    best = score(await worker.recognize(bytes));
    if (best.confidence >= 85 && best.text.length >= 20) return { text: best.text, confidence: best.confidence };
  } finally { await worker.terminate(); }
  const target = Math.min(2800, Math.max(metadata.width, metadata.height) < 1700 ? Math.round(Math.max(metadata.width, metadata.height) * 1.7) : Math.max(metadata.width, metadata.height));
  const base = sharp(bytes).rotate().resize({ width: target, height: target, fit: 'inside', withoutEnlargement: false }).greyscale().normalise().sharpen({ sigma: 1.2 });
  const processed = await base.png().toBuffer();
  const enhancedWorker = await createWorker('chi_sim+eng');
  try {
    await enhancedWorker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    const enhanced = score(await enhancedWorker.recognize(processed));
    if (enhanced.rank > best.rank + 3) best = enhanced;
    if (best.confidence < 75 || best.text.length < 20) {
      await enhancedWorker.setParameters({ tessedit_pageseg_mode: '6' });
      const highContrast = await sharp(processed).threshold(170).png().toBuffer();
      const alternative = score(await enhancedWorker.recognize(highContrast));
      if (alternative.rank > best.rank + 3) best = alternative;
    }
    return { text: best.text, confidence: best.confidence };
  } finally { await enhancedWorker.terminate(); }
}
