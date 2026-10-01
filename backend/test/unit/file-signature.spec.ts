import {
  detectFileFormat,
  matchesDeclaredExtension,
  FORMAT_MIME_TYPES,
} from '../../src/documents/file-signature';

const PDF_BYTES = Buffer.from('%PDF-1.4\n%some binary-ish content\n%%EOF', 'latin1');
const DOC_BYTES = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.from('rest of a legacy .doc file', 'latin1'),
]);
const DOCX_BYTES = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from('...[Content_Types].xml...rest of the zip entries...', 'ascii'),
]);
const PLAIN_ZIP_BYTES = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from('some-regular-file.txt not a docx at all', 'ascii'),
]);
const TXT_BYTES = Buffer.from('Instruções de preenchimento do formulário.\nSegunda linha.', 'utf8');
const EXE_BYTES = Buffer.concat([
  Buffer.from([0x4d, 0x5a]),
  Buffer.from([0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]),
]);
const ELF_BYTES = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
const SHEBANG_SCRIPT_BYTES = Buffer.from('#!/bin/sh\nrm -rf /\n', 'ascii');
const BINARY_WITH_NULL_BYTES = Buffer.from([0x41, 0x42, 0x00, 0x43, 0x44]);

/**
 * research.md #3 — verificação de conteúdo real do arquivo (FR-013a): cobre
 * os 4 formatos aceitos e os casos de recusa (extensão trocada pra simular
 * um formato aceito, executável/script disfarçado).
 */
describe('file-signature', () => {
  describe('detectFileFormat', () => {
    it('detects a PDF by its magic bytes', () => {
      expect(detectFileFormat(PDF_BYTES)).toBe('pdf');
    });

    it('detects a legacy DOC (Compound File Binary) by its magic bytes', () => {
      expect(detectFileFormat(DOC_BYTES)).toBe('doc');
    });

    it('detects a DOCX by the ZIP signature plus the [Content_Types].xml entry', () => {
      expect(detectFileFormat(DOCX_BYTES)).toBe('docx');
    });

    it('does not classify a plain ZIP (no [Content_Types].xml) as DOCX', () => {
      expect(detectFileFormat(PLAIN_ZIP_BYTES)).toBeNull();
    });

    it('detects plain UTF-8 text as TXT', () => {
      expect(detectFileFormat(TXT_BYTES)).toBe('txt');
    });

    it('does not classify a Windows executable (MZ) as TXT', () => {
      expect(detectFileFormat(EXE_BYTES)).toBeNull();
    });

    it('does not classify an ELF binary as TXT', () => {
      expect(detectFileFormat(ELF_BYTES)).toBeNull();
    });

    it('does not classify a shebang script as TXT', () => {
      expect(detectFileFormat(SHEBANG_SCRIPT_BYTES)).toBeNull();
    });

    it('does not classify binary content with null bytes as TXT', () => {
      expect(detectFileFormat(BINARY_WITH_NULL_BYTES)).toBeNull();
    });

    it('classifies an empty buffer as TXT (no null bytes, decodes as valid empty UTF-8)', () => {
      expect(detectFileFormat(Buffer.alloc(0))).toBe('txt');
    });
  });

  describe('matchesDeclaredExtension', () => {
    it('accepts the 4 formats when the extension matches the real content', () => {
      expect(matchesDeclaredExtension('formulario.pdf', PDF_BYTES)).toBe(true);
      expect(matchesDeclaredExtension('modelo.doc', DOC_BYTES)).toBe(true);
      expect(matchesDeclaredExtension('modelo.docx', DOCX_BYTES)).toBe(true);
      expect(matchesDeclaredExtension('manual.txt', TXT_BYTES)).toBe(true);
    });

    it('rejects an unsupported extension even with otherwise valid content', () => {
      expect(matchesDeclaredExtension('planilha.xlsx', DOCX_BYTES)).toBe(false);
    });

    it('rejects an executable renamed to a .pdf (extension vs. content mismatch, FR-013a)', () => {
      expect(matchesDeclaredExtension('relatorio.pdf', EXE_BYTES)).toBe(false);
    });

    it('rejects a shell script renamed to a .txt', () => {
      expect(matchesDeclaredExtension('instrucoes.txt', SHEBANG_SCRIPT_BYTES)).toBe(false);
    });

    it('rejects content of one accepted format declared under another accepted extension', () => {
      expect(matchesDeclaredExtension('modelo.docx', DOC_BYTES)).toBe(false);
      expect(matchesDeclaredExtension('modelo.pdf', TXT_BYTES)).toBe(false);
    });
  });

  it('maps every detected format to a real MIME type, never trusting the request header', () => {
    expect(FORMAT_MIME_TYPES.pdf).toBe('application/pdf');
    expect(FORMAT_MIME_TYPES.doc).toBe('application/msword');
    expect(FORMAT_MIME_TYPES.docx).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(FORMAT_MIME_TYPES.txt).toBe('text/plain');
  });
});
