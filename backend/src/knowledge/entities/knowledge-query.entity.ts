import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum KnowledgeQueryOutcome {
  /** Resposta gerada pela IA com base nos trechos. */
  ANSWERED = 'ANSWERED',
  /** Nada relevante nos documentos: "Não foi possível encontrar a resposta". */
  NO_ANSWER = 'NO_ANSWER',
  /** A IA de chat falhou; a resposta são os trechos brutos. */
  EXCERPTS_ONLY = 'EXCERPTS_ONLY',
}

/** Cópia do trecho usado, gravada no registro: sobrevive à exclusão/atualização do documento (FR-026). */
export interface KnowledgeQuerySource {
  documentId: number;
  documentName: string;
  position: number;
  excerpt: string;
}

/**
 * Histórico de consultas. Imutável: uma trigger no banco (criada na migration)
 * bloqueia UPDATE, DELETE e TRUNCATE, e nenhum service/controller os expõe (FR-024).
 */
@Entity('knowledge_queries')
@Index('IDX_knowledge_queries_created_at', ['createdAt'])
@Index('IDX_knowledge_queries_user_created_at', ['user', 'createdAt'])
export class KnowledgeQuery {
  @PrimaryGeneratedColumn()
  id: number;

  /** Quem perguntou. RESTRICT: o usuário não pode ser apagado enquanto tiver histórico. */
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ type: 'varchar', length: 20 })
  outcome: KnowledgeQueryOutcome;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  sources: KnowledgeQuerySource[];

  /** Só em EXCERPTS_ONLY: tipo da falha da IA (RATE_LIMIT, QUOTA_OR_AUTH, UNAVAILABLE, TIMEOUT). */
  @Column({ type: 'varchar', length: 30, nullable: true })
  failureKind: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
