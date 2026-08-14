import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { CellsService } from '../../src/cells/cells.service';
import { Cell, CellType } from '../../src/cells/entities/cell.entity';
import { Inmate, InmateStatus } from '../../src/inmates/entities/inmate.entity';
import { GalleriesService } from '../../src/galleries/galleries.service';
import { Gallery } from '../../src/galleries/entities/gallery.entity';
import { Unit } from '../../src/units/entities/unit.entity';

type MockRepository<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function createMockRepository<T extends ObjectLiteral>(): MockRepository<T> {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
  };
}

describe('CellsService', () => {
  let service: CellsService;
  let cellRepository: MockRepository<Cell>;
  let inmateRepository: MockRepository<Inmate>;
  let galleriesService: { findEntityInScope: jest.Mock };

  const gallery = { id: 10, unit: { id: 1 } as Unit } as Gallery;

  beforeEach(async () => {
    cellRepository = createMockRepository<Cell>();
    inmateRepository = createMockRepository<Inmate>();
    galleriesService = { findEntityInScope: jest.fn().mockResolvedValue(gallery) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CellsService,
        { provide: getRepositoryToken(Cell), useValue: cellRepository },
        { provide: getRepositoryToken(Inmate), useValue: inmateRepository },
        { provide: GalleriesService, useValue: galleriesService },
      ],
    }).compile();

    service = module.get(CellsService);
  });

  describe('create', () => {
    it('rejects negative capacity even if the DTO validation layer is bypassed', async () => {
      await expect(
        service.create({ galleryId: 10, code: '01', capacity: -1, type: CellType.SHARED }, [1]),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(cellRepository.save).not.toHaveBeenCalled();
    });

    it('accepts capacity = 0 (an out-of-service or holding cell)', async () => {
      cellRepository.create!.mockReturnValue({
        id: 1,
        gallery,
        code: '01',
        capacity: 0,
        active: true,
      });
      cellRepository.save!.mockResolvedValue({
        id: 1,
        gallery,
        code: '01',
        capacity: 0,
        type: CellType.SHARED,
        active: true,
      });

      const result = await service.create(
        { galleryId: 10, code: '01', capacity: 0, type: CellType.SHARED },
        [1],
      );

      expect(result.capacity).toBe(0);
      expect(cellRepository.save).toHaveBeenCalled();
    });

    it('rejects creating a cell in a gallery outside the caller unit scope', async () => {
      galleriesService.findEntityInScope.mockRejectedValueOnce(new ForbiddenException());

      await expect(
        service.create({ galleryId: 10, code: '01', capacity: 2, type: CellType.SHARED }, [999]),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('occupancyOf', () => {
    it('counts only ACTIVE inmates currently in the cell', async () => {
      inmateRepository.count!.mockResolvedValue(2);

      const occupancy = await service.occupancyOf(3);

      expect(occupancy).toBe(2);
      expect(inmateRepository.count).toHaveBeenCalledWith({
        where: { currentCell: { id: 3 }, status: InmateStatus.ACTIVE },
      });
    });
  });
});
