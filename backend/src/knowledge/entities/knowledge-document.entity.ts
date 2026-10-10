import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Ciclo de vida de um documento na base de conhecimento (data-model.md):
 * só READY e UPDATING participam das respostas.
 */
export enum KnowledgeDocumentStatus {
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  /** Nova versão em processamento; os trechos da versão anterior seguem disponíveis. */
  UPDATING = 'UPDATING',
  FAILED = 'FAILED',
  /** Indexado com outro modelo de embeddings; precisa ser reprocessado. */
  NEEDS_REPROCESS = 'NEEDS_REPROCESS',
}

/**
 * Documento carregado para consulta (PDF/DOCX/TXT). Distinto de `documents`
 * (biblioteca de Formulários/Modelos/Manuais da feature 002).
 */
@Entity('knowledge_documents')
@Index(['name'], { unique: true })
export class KnowledgeDocument {
  @PrimaryGeneratedColumn()
  id: number;

  /** Nome de exibição; único entre os documentos da base (FR-017). */
  @Column({ type: 'varchar', length: 200 })
  name: string;

  /** Caminho relativo em KNOWLEDGE_STORAGE_PATH; nome gerado (UUID), nunca exposto. */
  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  /** Arquivo da nova versão, preenchido só enquanto o status é UPDATING. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  pendingFilePath: string | null;

  /** Nome do arquivo como enviado; só para exibição. */
  @Column({ type: 'varchar', length: 255 })
  originalFileName: string;

  /** 'pdf' | 'docx' | 'txt' — detectado pelo conteúdo, nunca pela extensão. */
  @Column({ type: 'varchar', length: 10 })
  fileFormat: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @Column({ type: 'varchar', length: 20 })
  status: KnowledgeDocumentStatus;

  /** Código do motivo da falha (ex.: NO_EXTRACTABLE_TEXT). Em READY, indica falha da última atualização. */
  @Column({ type: 'varchar', length: 40, nullable: true })
  failureReason: string | null;

  @Column({ type: 'int', default: 0 })
  chunkCount: number;

  /** Autor do envio (ou da última atualização). */
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedBy: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
