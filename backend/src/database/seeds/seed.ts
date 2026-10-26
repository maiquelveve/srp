import 'reflect-metadata';
import * as argon2 from 'argon2';
import { AppDataSource } from '../data-source';
import { Role, RoleName } from '../../roles/entities/role.entity';
import { User } from '../../users/entities/user.entity';
import { Unit } from '../../units/entities/unit.entity';
import { Gallery, GalleryType } from '../../galleries/entities/gallery.entity';
import { Cell, CellType } from '../../cells/entities/cell.entity';
import { MovementType, MovementCategory } from '../../movements/entities/movement-type.entity';

/**
 * Minimal seed per quickstart.md pré-requisitos: 3 roles, 1 sample user per
 * role, 1 unit, 1 gallery, 2 cells, 3 movement types (>=1 TEMPORARY, >=1 PERMANENT).
 * Run with `npm run seed` after `npm run migration:run`.
 */
async function seed(): Promise<void> {
  await AppDataSource.initialize();

  const roleRepo = AppDataSource.getRepository(Role);
  const userRepo = AppDataSource.getRepository(User);
  const unitRepo = AppDataSource.getRepository(Unit);
  const galleryRepo = AppDataSource.getRepository(Gallery);
  const cellRepo = AppDataSource.getRepository(Cell);
  const movementTypeRepo = AppDataSource.getRepository(MovementType);

  const roles = await roleRepo.save(
    [
      { name: RoleName.PRISON_OFFICER, description: 'Policial Penal' },
      { name: RoleName.SUPERVISOR, description: 'Supervisor' },
      { name: RoleName.WARDEN, description: 'Chefia/Diretor' },
    ].map((r) => roleRepo.create(r)),
  );

  const unit = await unitRepo.save(
    unitRepo.create({
      name: 'Penitenciária Estadual de Charqueadas II',
      code: 'PEC II',
      active: true,
    }),
  );

  const gallery = await galleryRepo.save(
    galleryRepo.create({ unit, code: 'A', type: GalleryType.MALE, active: true }),
  );

  await cellRepo.save([
    cellRepo.create({ gallery, code: '01', capacity: 4, type: CellType.SHARED, active: true }),
    cellRepo.create({ gallery, code: '02', capacity: 1, type: CellType.INDIVIDUAL, active: true }),
  ]);

  // Pátio/corre/faxina NÃO entram aqui — são atividades coletivas por galeria
  // (Rotina, US4), nunca uma Movimentação individual por preso (research.md #26).
  await movementTypeRepo.save([
    movementTypeRepo.create({
      name: 'Atendimento médico interno',
      category: MovementCategory.TEMPORARY,
    }),
    movementTypeRepo.create({ name: 'Parlatório', category: MovementCategory.TEMPORARY }),
    movementTypeRepo.create({ name: 'Liberdade', category: MovementCategory.PERMANENT }),
    // US3 — situações definitivas (contracts/movements.md, FR-013/FR-014/FR-015).
    movementTypeRepo.create({
      name: 'Tornozeleira eletrônica',
      category: MovementCategory.PERMANENT,
    }),
    movementTypeRepo.create({ name: 'Transferência', category: MovementCategory.PERMANENT }),
    // Troca/permuta de cela/galeria (research.md #35, FR-015–FR-015c) — status
    // do preso continua ACTIVE, mas category=PERMANENT porque nunca têm
    // returnDateTime (mesmo raciocínio de research.md #9).
    movementTypeRepo.create({ name: 'Troca de cela', category: MovementCategory.PERMANENT }),
    movementTypeRepo.create({ name: 'Permuta de cela', category: MovementCategory.PERMANENT }),
    movementTypeRepo.create({ name: 'Troca de galeria', category: MovementCategory.PERMANENT }),
    movementTypeRepo.create({ name: 'Permuta de galeria', category: MovementCategory.PERMANENT }),
    // O tipo "Reversão de situação definitiva" (FR-016a) NÃO é criado aqui: a migration
    // AddReversalMovementType já o insere, e criá-lo nos dois lugares quebrava o seed
    // em banco novo (violação de unicidade em movement_types.name).
  ]);

  const seedPassword = process.env.SEED_USER_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await argon2.hash(seedPassword);

  const seedUsers = [
    {
      name: 'Policial Seed',
      email: 'policial@srp.rs.gov.br',
      role: roles[0],
      badgeNumber: 'PP-1001',
      jobTitle: 'Agente Penitenciário',
    },
    {
      name: 'Supervisor Seed',
      email: 'supervisor@srp.rs.gov.br',
      role: roles[1],
      badgeNumber: 'PP-2001',
      jobTitle: 'Supervisor de Plantão',
    },
    {
      name: 'Diretor Seed',
      email: 'diretor@srp.rs.gov.br',
      role: roles[2],
      badgeNumber: 'PP-3001',
      jobTitle: 'Diretor de Unidade',
    },
  ];

  for (const u of seedUsers) {
    await userRepo.save(
      userRepo.create({
        name: u.name,
        email: u.email,
        passwordHash,
        badgeNumber: u.badgeNumber,
        jobTitle: u.jobTitle,
        role: u.role,
        units: [unit],
        active: true,
      }),
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed complete. Sample users password: "${seedPassword}" (set SEED_USER_PASSWORD to override).`,
  );

  await AppDataSource.destroy();
}

seed().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
