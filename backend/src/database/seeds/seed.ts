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
    unitRepo.create({ name: 'Unidade Central', code: 'UC-01', active: true }),
  );

  const gallery = await galleryRepo.save(
    galleryRepo.create({ unit, code: 'A', type: GalleryType.MALE, active: true }),
  );

  await cellRepo.save([
    cellRepo.create({ gallery, code: '01', capacity: 4, type: CellType.SHARED, active: true }),
    cellRepo.create({ gallery, code: '02', capacity: 1, type: CellType.INDIVIDUAL, active: true }),
  ]);

  await movementTypeRepo.save([
    movementTypeRepo.create({ name: 'Pátio', category: MovementCategory.TEMPORARY }),
    movementTypeRepo.create({
      name: 'Atendimento médico interno',
      category: MovementCategory.TEMPORARY,
    }),
    movementTypeRepo.create({ name: 'Liberdade', category: MovementCategory.PERMANENT }),
  ]);

  const seedPassword = process.env.SEED_USER_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await argon2.hash(seedPassword);

  const seedUsers = [
    { name: 'Policial Seed', email: 'policial@srp.rs.gov.br', role: roles[0] },
    { name: 'Supervisor Seed', email: 'supervisor@srp.rs.gov.br', role: roles[1] },
    { name: 'Diretor Seed', email: 'diretor@srp.rs.gov.br', role: roles[2] },
  ];

  for (const u of seedUsers) {
    await userRepo.save(
      userRepo.create({
        name: u.name,
        email: u.email,
        passwordHash,
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
