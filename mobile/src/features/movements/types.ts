export type MovementCategory = 'TEMPORARY' | 'PERMANENT';

export interface MovementType {
  id: number;
  name: string;
  category: MovementCategory;
  description: string | null;
}
