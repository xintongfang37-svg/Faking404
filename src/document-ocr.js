import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { recognizeDocument as tesseractOcr } from './ocr.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

function rapidOcr(bytes) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, [path.join(root, 'src', 'rapid_ocr.py')], { stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => child.kill(), 60000);
    const output = [];
    const errors = [];
    child.stdout.on('data', chunk => output.push(chunk));
    child.stderr.on('data', chunk => errors.push(chunk));
    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`RapidOCR 运行失败：${Buffer.concat(errors).toString('utf8').slice(-500)}`));
      try { resolve(JSON.parse(Buffer.concat(output).toString('utf8'))); }
      catch { reject(new Error('RapidOCR 返回格式无效')); }
    });
    child.stdin.end(bytes);
  });
}

export async function recognizeDocument(bytes) {
  if (fs.existsSync(python)) return rapidOcr(bytes);
  return { ...await tesseractOcr(bytes), engine: 'tesseract' };
}
