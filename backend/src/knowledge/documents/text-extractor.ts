import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

/** Formatos aceitos na base de conhecimento (sem `.doc`; research.md #2). */
export const KNOWLEDGE_FILE_FORMATS = ['pdf', 'docx', 'txt'] as const;
export type KnowledgeFileFormat = (typeof KNOWLEDGE_FILE_FORMATS)[number];

export type TextExtractionFailureReason = 'NO_EXTRACTABLE_TEXT' | 'CORRUPTED_FILE';

/**
 * Falha previsível de extração. A mensagem é fixa de propósito: nunca carrega
 * trecho do documento nem a mensagem da biblioteca (FR-032).
 */
export class TextExtractionError extends Error {
  constructor(readonly reason: TextExtractionFailureReason) {
    super(`Text extraction failed: ${reason}`);
    this.name = 'TextExtractionError';
  }
}

/** Caracteres de controle quebram o PostgreSQL (NUL) ou só poluem o embedding. */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
const BYTE_ORDER_MARK = /^﻿/;

@Injectable()
export class TextExtractor {
  /**
   * `format` é o formato DETECTADO pelo conteúdo (`detectFileFormat`), nunca a
   * extensão declarada. Devolve o texto limpo ou lança `TextExtractionError`.
   */
  async extract(buffer: Buffer, format: KnowledgeFileFormat): Promise<string> {
    let rawText: string;
    try {
      rawText = await this.readRawText(buffer, format);
    } catch {
      throw new TextExtractionError('CORRUPTED_FILE');
    }

    const text = rawText.replace(BYTE_ORDER_MARK, '').replace(CONTROL_CHARACTERS, ' ').trim();
    if (text.length === 0) {
      throw new TextExtractionError('NO_EXTRACTABLE_TEXT');
    }
    return text;
  }

  private async readRawText(buffer: Buffer, format: KnowledgeFileFormat): Promise<string> {
    switch (format) {
      case 'txt':
        return buffer.toString('utf8');
      case 'docx': {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }
      case 'pdf':
        return this.readPdf(buffer);
    }
  }

  private async readPdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      // pageJoiner '' evita o marcador "-- N of M --" que a biblioteca injeta por página.
      const result = await parser.getText({ pageJoiner: '' });
      return result.text;
    } finally {
      await parser.destroy();
    }
  }
}
