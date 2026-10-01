import { extname } from 'path';

/**
 * Verificação de conteúdo real do arquivo (FR-013a, research.md #3) — nunca
 * confia na extensão declarada nem no `mimetype` que o navegador manda.
 * Implementação própria, sem dependência de terceiros (research.md #3
 * explica a rejeição de `file-type`: versões atuais são ESM-only).
 */

const PDF_SIGNATURE = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // DOCX é OOXML = ZIP
const DOC_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // Compound File Binary

/** Assinaturas de executáveis/scripts — qualquer uma delas descarta a hipótese de TXT. */
const EXECUTABLE_SIGNATURES = [
  Buffer.from([0x4d, 0x5a]), // MZ, Windows PE (.exe/.dll)
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF, binário Linux
  Buffer.from('#!', 'ascii'), // shebang de script
];

/** DOCX é um ZIP OOXML — só o cabeçalho ZIP não basta pra diferenciar de um .zip qualquer renomeado. */
const DOCX_CONTENT_TYPES_ENTRY = '[Content_Types].xml';

export type DetectedFileFormat = 'pdf' | 'docx' | 'doc' | 'txt';

/** MIME real por formato detectado — o que é persistido em `Document.mimeType` (nunca o header da requisição). */
export const FORMAT_MIME_TYPES: Record<DetectedFileFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
};

const EXTENSION_TO_FORMAT: Record<string, DetectedFileFormat> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.doc': 'doc',
  '.txt': 'txt',
};

export const ACCEPTED_EXTENSIONS = Object.keys(EXTENSION_TO_FORMAT);

function startsWith(buffer: Buffer, signature: Buffer): boolean {
  return (
    buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature)
  );
}

/** TXT não tem assinatura própria: válido por exclusão (nada binário conhecido) + heurística de texto. */
function looksLikePlainText(buffer: Buffer): boolean {
  if (buffer.includes(0x00)) {
    return false;
  }
  // Round-trip UTF-8: se o conteúdo não decodificava como UTF-8/ASCII válido,
  // re-codificar o resultado diverge do buffer original.
  return Buffer.from(buffer.toString('utf8'), 'utf8').equals(buffer);
}

/** Detecta o formato real pelos primeiros bytes do conteúdo — nunca pela extensão. */
export function detectFileFormat(buffer: Buffer): DetectedFileFormat | null {
  if (startsWith(buffer, PDF_SIGNATURE)) {
    return 'pdf';
  }
  if (startsWith(buffer, DOC_SIGNATURE)) {
    return 'doc';
  }
  if (startsWith(buffer, ZIP_SIGNATURE)) {
    return buffer.includes(DOCX_CONTENT_TYPES_ENTRY, 0, 'ascii') ? 'docx' : null;
  }
  const isExecutable = EXECUTABLE_SIGNATURES.some((signature) => startsWith(buffer, signature));
  if (isExecutable) {
    return null;
  }
  return looksLikePlainText(buffer) ? 'txt' : null;
}

/**
 * `400` se: (a) a extensão declarada não está entre as 4 aceitas, ou (b) o
 * conteúdo real não corresponde ao formato que a extensão declara —
 * inclusive quando a extensão foi trocada pra simular um formato aceito
 * (FR-013a).
 */
export function matchesDeclaredExtension(originalFileName: string, buffer: Buffer): boolean {
  const extension = extname(originalFileName).toLowerCase();
  const expectedFormat = EXTENSION_TO_FORMAT[extension];
  if (!expectedFormat) {
    return false;
  }
  return detectFileFormat(buffer) === expectedFormat;
}
