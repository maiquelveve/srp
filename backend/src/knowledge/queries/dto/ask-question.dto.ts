import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import loadConfiguration from '../../../config/configuration';

/** Mínimo de caracteres de uma pergunta (depois do `trim`). */
export const QUESTION_MIN_LENGTH = 3;

/** `POST /api/v1/knowledge/queries`. Pergunta inválida nunca chega à IA nem ao banco (FR-009). */
export class AskQuestionDto {
  /** Pergunta em linguagem natural; os espaços das pontas são removidos antes de validar o tamanho. */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(QUESTION_MIN_LENGTH)
  @MaxLength(loadConfiguration().knowledge.questionMaxLength)
  question: string;
}
