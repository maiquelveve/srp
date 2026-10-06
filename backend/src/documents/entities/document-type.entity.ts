import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Document } from './document.entity';

/**
 * 3 linhas fixas (`FORM`/`TEMPLATE`/`MANUAL`), inseridas via seed na migration
 * `AddDocumentsTables` — sem endpoint de criar/editar/remover, lista fechada
 * por decisão de escopo (data-model.md, FR-009).
 */
@Entity('document_types')
export class DocumentType {
  @PrimaryGeneratedColumn()
  id: number;

  /** Identificador estável em inglês, nunca exposto como rótulo na UI. */
  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  /** Rótulo em português exibido na interface. */
  @Column({ type: 'varchar', length: 50 })
  label: string;

  @OneToMany(() => Document, (document) => document.documentType)
  documents: Document[];
}
