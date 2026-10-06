import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DocumentType } from './document-type.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Formulário/modelo/manual publicado na biblioteca (contracts/documents.md).
 * Único junto com `documentTypeId` (constraint composta, research.md #9) —
 * mesmo nome pode existir em categorias diferentes, não na mesma.
 */
@Entity('documents')
@Index(['documentType', 'name'], { unique: true })
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  /** Nome de exibição escolhido por quem envia — distinto do nome do arquivo em disco. */
  @Column({ type: 'varchar', length: 200 })
  name: string;

  /**
   * Caminho relativo dentro de `DOCUMENTS_STORAGE_PATH`, nome gerado
   * (`crypto.randomUUID()` + extensão original) — nunca o nome de exibição
   * nem o nome original do arquivo, pra evitar colisão e path traversal
   * (research.md #8). Nunca exposto ao frontend; download passa pelo
   * endpoint autenticado, não por URL direta ao arquivo.
   */
  @Column({ type: 'varchar', length: 500 })
  path: string;

  /** Nome do arquivo como enviado — usado só para nomear o download no navegador. */
  @Column({ type: 'varchar', length: 255 })
  originalFileName: string;

  /** Detectado pela verificação de assinatura (research.md #3), nunca confiado do header da requisição. */
  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @ManyToOne(() => DocumentType, { nullable: false })
  @JoinColumn({ name: 'document_type_id' })
  documentType: DocumentType;

  /** Quem enviou — auditoria e, se necessário, exibição de "enviado por". */
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedBy: User;

  /** Data de publicação — ordena a listagem, mais recente primeiro (FR-011). */
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
