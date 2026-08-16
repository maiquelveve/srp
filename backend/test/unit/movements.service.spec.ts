import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { MovementsService } from '../../src/movements/movements.service';
import { Movement } from '../../src/movements/entities/movement.entity';
import { MovementCategory, MovementType } from '../../src/movements/entities/movement-type.entity';
import { MovementTypesService } from '../../src/movements/movement-types.service';
import { InmatesService } from '../../src/inmates/inmates.service';
import { CellsService } from '../../src/cells/cells.service';
import { Inmate } from '../../src/inmates/entities/inmate.entity';
import { Cell } from '../../src/cells/entities/cell.entity';
import { JwtPayload } from '../../src/auth/types/jwt-payload.type';
import { RoleName } from '../../src/roles/entities/role.entity';

type MockRepository<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function createMockRepository<T extends ObjectLiteral>(): MockRepository<T> {
  return {
    create: jest.fn((x) => x),
    save: jest.fn((x) => Promise.resolve(x)),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function mockQueryBuilder(getOneResult: unknown): Partial<SelectQueryBuilder<Movement>> {
  const qb: Partial<SelectQueryBuilder<Movement>> = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(getOneResult),
  } as unknown as Partial<SelectQueryBuilder<Movement>>;
  return qb;
}

describe('MovementsService', () => {
  let service: MovementsService;
  let movementRepository: MockRepository<Movement>;
  let movementTypesService: { findById: jest.Mock };
  let inmatesService: { findEntityInScope: jest.Mock };
  let cellsService: { findEntityInScope: jest.Mock };

  const currentUser: JwtPayload = { sub: 1, role: RoleName.PRISON_OFFICER, units: [1] };
  const inmate = { id: 101 } as Inmate;
  const cell = { id: 42 } as Cell;
  const user = { id: 1 };
  const temporaryType = {
    id: 4,
    name: 'Atendimento médico interno',
    category: MovementCategory.TEMPORARY,
  } as MovementType;
  const permanentType = {
    id: 9,
    name: 'Liberdade',
    category: MovementCategory.PERMANENT,
  } as MovementType;

  beforeEach(async () => {
    movementRepository = createMockRepository<Movement>();
    movementTypesService = { findById: jest.fn().mockResolvedValue(temporaryType) };
    inmatesService = { findEntityInScope: jest.fn().mockResolvedValue(inmate) };
    cellsService = { findEntityInScope: jest.fn().mockResolvedValue(cell) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        { provide: getRepositoryToken(Movement), useValue: movementRepository },
        { provide: MovementTypesService, useValue: movementTypesService },
        { provide: InmatesService, useValue: inmatesService },
        { provide: CellsService, useValue: cellsService },
      ],
    }).compile();

    service = module.get(MovementsService);
  });

  describe('create', () => {
    it('rejects a second open movement for the same inmate (FR-010)', async () => {
      (movementRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder({ id: 555 }),
      );

      await expect(
        service.create(
          { inmateId: 101, movementTypeId: 4, originCellId: 42, destinationLocation: 'Enfermaria' },
          currentUser,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(movementRepository.save).not.toHaveBeenCalled();
    });

    it('rejects a PERMANENT movement type on the temporary-movement endpoint', async () => {
      movementTypesService.findById.mockResolvedValue(permanentType);
      (movementRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder(null));

      await expect(
        service.create(
          { inmateId: 101, movementTypeId: 9, originCellId: 42, destinationLocation: 'Enfermaria' },
          currentUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(movementRepository.save).not.toHaveBeenCalled();
    });

    it('creates the movement when no open movement exists for the inmate', async () => {
      (movementRepository.createQueryBuilder as jest.Mock).mockReturnValue(mockQueryBuilder(null));
      movementRepository.save!.mockResolvedValue({
        id: 1,
        inmate,
        movementType: temporaryType,
        originCell: cell,
        destinationLocation: 'Enfermaria',
        reason: null,
        notes: null,
        exitDateTime: new Date(),
        returnDateTime: null,
        idempotencyKey: null,
        user,
      });

      const result = await service.create(
        { inmateId: 101, movementTypeId: 4, originCellId: 42, destinationLocation: 'Enfermaria' },
        currentUser,
      );

      expect(result.created).toBe(true);
      expect(movementRepository.save).toHaveBeenCalled();
    });

    it('replays an Idempotency-Key match instead of re-checking for conflicts', async () => {
      const existing = {
        id: 1,
        inmate,
        movementType: temporaryType,
        originCell: cell,
        destinationLocation: 'Enfermaria',
        reason: null,
        notes: null,
        exitDateTime: new Date(),
        returnDateTime: null,
        idempotencyKey: 'key-123',
        user,
      };
      movementRepository.findOne!.mockResolvedValue(existing);

      const result = await service.create(
        { inmateId: 101, movementTypeId: 4, originCellId: 42, destinationLocation: 'Enfermaria' },
        currentUser,
        'key-123',
      );

      expect(result.created).toBe(false);
      expect(result.data.id).toBe(1);
      expect(inmatesService.findEntityInScope).not.toHaveBeenCalled();
      expect(movementRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('rejects editing a movement that already has a return registered', async () => {
      movementRepository.findOne!.mockResolvedValue({
        id: 1,
        inmate,
        movementType: temporaryType,
        originCell: cell,
        returnDateTime: new Date('2026-01-01T00:00:00Z'),
        user,
      });

      await expect(service.update(1, { destinationLocation: 'Ala B' }, [1])).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(movementRepository.save).not.toHaveBeenCalled();
    });

    it('rejects switching to a PERMANENT movement type', async () => {
      movementRepository.findOne!.mockResolvedValue({
        id: 1,
        inmate,
        movementType: temporaryType,
        originCell: cell,
        returnDateTime: null,
        user,
      });
      movementTypesService.findById.mockResolvedValue(permanentType);

      await expect(service.update(1, { movementTypeId: 9 }, [1])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(movementRepository.save).not.toHaveBeenCalled();
    });

    it('updates destinationLocation/reason on an open movement', async () => {
      const open = {
        id: 1,
        inmate,
        movementType: temporaryType,
        originCell: cell,
        destinationLocation: 'Enfermaria',
        reason: 'Consulta',
        returnDateTime: null,
        user,
      };
      movementRepository.findOne!.mockResolvedValue(open);
      movementRepository.save!.mockImplementation((m) => Promise.resolve(m));

      const result = await service.update(
        1,
        { destinationLocation: 'Ala B', reason: 'Corrigido' },
        [1],
      );

      expect(result.destinationLocation).toBe('Ala B');
      expect(result.reason).toBe('Corrigido');
      expect(movementRepository.save).toHaveBeenCalled();
    });
  });

  describe('returnMovement', () => {
    it('rejects returning an already-returned movement (FR-009 edge case)', async () => {
      movementRepository.findOne!.mockResolvedValue({
        id: 1,
        inmate,
        movementType: temporaryType,
        originCell: cell,
        returnDateTime: new Date('2026-01-01T00:00:00Z'),
        returnIdempotencyKey: null,
        user,
      });

      await expect(service.returnMovement(1, {}, [1])).rejects.toBeInstanceOf(ConflictException);
      expect(movementRepository.save).not.toHaveBeenCalled();
    });

    it('allows a matching Idempotency-Key replay of an already-returned movement', async () => {
      const returned = {
        id: 1,
        inmate,
        movementType: temporaryType,
        originCell: cell,
        returnDateTime: new Date('2026-01-01T00:00:00Z'),
        returnIdempotencyKey: 'return-key',
        user,
      };
      movementRepository.findOne!.mockResolvedValue(returned);

      const result = await service.returnMovement(1, {}, [1], 'return-key');

      expect(result.returned).toBe(false);
      expect(movementRepository.save).not.toHaveBeenCalled();
    });

    it('records the return on an open movement', async () => {
      const open = {
        id: 1,
        inmate,
        movementType: temporaryType,
        originCell: cell,
        returnDateTime: null,
        returnIdempotencyKey: null,
        user,
      };
      movementRepository.findOne!.mockResolvedValue(open);
      movementRepository.save!.mockImplementation((m) => Promise.resolve(m));

      const result = await service.returnMovement(1, {}, [1]);

      expect(result.returned).toBe(true);
      expect(result.data.returnDateTime).not.toBeNull();
      expect(movementRepository.save).toHaveBeenCalled();
    });
  });
});
