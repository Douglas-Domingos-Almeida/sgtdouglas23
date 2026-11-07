const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const imageTypes = {
  'image/jpeg': { extension: 'jpg', signature: (buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: 'png', signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/webp': { extension: 'webp', signature: (buffer) => buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' }
};

function inspectImage(buffer, mimeType, allowedTypes, maximumSize) {
  if (!Buffer.isBuffer(buffer) || !allowedTypes.includes(mimeType) || !imageTypes[mimeType]?.signature(buffer)) {
    return 'O conteúdo do arquivo não corresponde a uma imagem permitida válida.';
  }
  if (buffer.length > maximumSize) return 'A imagem deve ter no máximo 2 MB.';
  return '';
}

function parseImageDataUrl(value, allowedTypes, maximumSize) {
  if (typeof value !== 'string') return { error: 'A imagem deve ser JPG, PNG ou WEBP válida.' };
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/);
  if (!match || !allowedTypes.includes(match[1])) {
    return { error: 'A imagem deve ser JPG, PNG ou WEBP válida.' };
  }
  const buffer = Buffer.from(match[2], 'base64');
  const error = inspectImage(buffer, match[1], allowedTypes, maximumSize);
  return error ? { error } : { buffer, mimeType: match[1] };
}

function saveImage(buffer, mimeType, uploadsDirectory) {
  const type = imageTypes[mimeType];
  if (!type) throw new Error('O tipo de imagem não é permitido.');
  fs.mkdirSync(uploadsDirectory, { recursive: true });
  const filename = `${crypto.randomUUID()}.${type.extension}`;
  const destination = path.join(uploadsDirectory, filename);
  const temporary = `${destination}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, buffer, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, destination);
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch (cleanupError) {
      console.error('Não foi possível remover um arquivo temporário de imagem.', cleanupError);
    }
    throw new Error(`Não foi possível salvar a imagem enviada: ${error.message}`);
  }
  return `/uploads/${filename}`;
}

function removeImage(imageUrl, uploadsDirectory) {
  const match = typeof imageUrl === 'string'
    ? imageUrl.match(/^\/uploads\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/i)
    : null;
  if (!match) return;
  const filePath = path.join(uploadsDirectory, match[1]);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

module.exports = { inspectImage, parseImageDataUrl, removeImage, saveImage };
