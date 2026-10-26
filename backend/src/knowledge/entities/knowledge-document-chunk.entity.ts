import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { KnowledgeDocument } from './knowledge-document.entity';

/**
 * O pgvector devolve a coluna `vector` como texto ("[0.1,0.2,...]") e só
 * aceita texto nesse mesmo formato na escrita; aqui convertemos de/para number[].
 */
export const vectorTransformer = {
  to: (value: number[] | null | undefined): string | null | undefined =>
    value ? `[${value.join(',')}]` : value,
  from: (value: string | null): number[] | null => (value ? (JSON.parse(value) as number[]) : null),
};

/**
 * Trecho (~300 a 500 palavras) de um documento, com o vetor de embedding usado
 * na busca por similaridade. O índice HNSW da busca (vector_cosine_ops) é
 * criado só na migration: o TypeORM não consegue descrevê-lo.
 */
@Entity('knowledge_document_chunks')
@Index(['document', 'position'], { unique: true })
export class KnowledgeDocumentChunk {
  @PrimaryGeneratedColumn()
  id: number;

  /** Excluir o documento remove seus trechos (cascade). */
  @ManyToOne(() => KnowledgeDocument, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: KnowledgeDocument;

  /** Ordem do trecho dentro do documento (0 = primeiro). */
  @Column({ type: 'int' })
  position: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int' })
  wordCount: number;

  /** Dimensão = EMBEDDING_DIMENSIONS; a migration e esta entity precisam concordar. */
  @Column({ type: 'vector', length: 1024, transformer: vectorTransformer })
  embedding: number[];

  /** Modelo que gerou o vetor (ex.: "ollama:bge-m3"); vetores de modelos diferentes não se comparam. */
  @Column({ type: 'varchar', length: 100 })
  embeddingModel: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
