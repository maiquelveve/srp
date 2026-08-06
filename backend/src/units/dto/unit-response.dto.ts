import { Unit } from '../entities/unit.entity';

export class UnitResponseDto {
  id: number;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  active: boolean;

  static fromEntity(unit: Unit): UnitResponseDto {
    const dto = new UnitResponseDto();
    dto.id = unit.id;
    dto.name = unit.name;
    dto.code = unit.code;
    dto.address = unit.address;
    dto.phone = unit.phone;
    dto.active = unit.active;
    return dto;
  }
}
