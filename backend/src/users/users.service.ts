import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { User } from './entities/user.entity';
import { InviteToken } from './entities/invite-token.entity';
import { Role } from '../roles/entities/role.entity';
import { Unit } from '../units/entities/unit.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PasswordHasherService } from '../auth/hashing/password-hasher.service';
import { assertUnitScope } from '../auth/unit-scope.util';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

const USER_RELATIONS = { role: true, units: true } as const;
const INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(Unit) private readonly unitRepository: Repository<Unit>,
    @InjectRepository(InviteToken)
    private readonly inviteTokenRepository: Repository<InviteToken>,
    private readonly passwordHasher: PasswordHasherService,
    private readonly auditService: AuditService,
  ) {}

  /** Includes passwordHash — internal use only (AuthService), never returned by an API. */
  async findByEmailForAuth(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email }, relations: USER_RELATIONS });
  }

  async findByIdForAuth(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id }, relations: USER_RELATIONS });
  }

  async list(
    query: ListUsersQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const usersQuery = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .leftJoinAndSelect('user.units', 'unit')
      // Every listing MUST stay scoped to the caller's units (FR-004a), even with no explicit filter.
      .where('unit.id IN (:...callerUnitIds)', { callerUnitIds });

    if (query.role) {
      usersQuery.andWhere('role.name = :role', { role: query.role });
    }
    if (query.unitId) {
      assertUnitScope(callerUnitIds, [query.unitId]);
      usersQuery.andWhere('unit.id = :unitId', { unitId: query.unitId });
    }

    const [users, total] = await usersQuery.getManyAndCount();
    return new PaginatedResponseDto(
      users.map((u) => UserResponseDto.fromEntity(u)),
      total,
    );
  }

  async create(dto: CreateUserDto, callerUnitIds: number[]): Promise<UserResponseDto> {
    assertUnitScope(callerUnitIds, dto.unitIds);

    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail');
    }

    const role = await this.roleRepository.findOne({ where: { name: dto.role } });
    if (!role) {
      throw new NotFoundException('Perfil inválido');
    }

    const units = await this.unitRepository.find({ where: { id: In(dto.unitIds) } });
    if (units.length !== dto.unitIds.length) {
      throw new NotFoundException('Uma ou mais unidades não encontradas');
    }

    // Unusable random placeholder — real password is set via the invite-token flow (research.md #10).
    const placeholderPassword = randomBytes(32).toString('hex');
    const passwordHash = await this.passwordHasher.hash(placeholderPassword);

    const user = await this.userRepository.save(
      this.userRepository.create({
        name: dto.name,
        email: dto.email,
        passwordHash,
        badgeNumber: dto.badgeNumber ?? null,
        jobTitle: dto.jobTitle ?? null,
        role,
        units,
        active: true,
      }),
    );

    await this.issueInviteToken(user);

    return UserResponseDto.fromEntity(user);
  }

  async deactivate(id: number, actingUserId: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id }, relations: USER_RELATIONS });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const oldData = { ...user, role: user.role.name, units: user.units.map((u) => u.id) };
    user.active = false;
    await this.userRepository.save(user);

    await this.auditService.record({
      userId: actingUserId,
      affectedTable: 'users',
      recordId: user.id,
      action: AuditAction.UPDATE,
      oldData: { ...oldData, active: true },
      newData: { ...oldData, active: false },
    });

    return UserResponseDto.fromEntity(user);
  }

  /** Creates a fresh single-use invite token (24h) — used at creation and can be reissued. */
  private async issueInviteToken(user: User): Promise<string> {
    const rawToken = randomUUID();
    const tokenHash = this.hashInviteToken(rawToken);
    await this.inviteTokenRepository.save(
      this.inviteTokenRepository.create({
        user,
        tokenHash,
        expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
        usedAt: null,
      }),
    );
    // TODO(US-later): deliver via a real notification/email service instead of a log line.
    this.logger.log(`Invite token for ${user.email}: ${rawToken} (expires in 24h)`);
    return rawToken;
  }

  private hashInviteToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async setInitialPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashInviteToken(rawToken);
    const invite = await this.inviteTokenRepository.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!invite || invite.usedAt || invite.expiresAt.getTime() < Date.now()) {
      throw new ConflictException('Convite inválido ou expirado');
    }

    invite.user.passwordHash = await this.passwordHasher.hash(newPassword);
    await this.userRepository.save(invite.user);

    invite.usedAt = new Date();
    await this.inviteTokenRepository.save(invite);

    // AuthController is @SkipAutoAudit()'d (its responses never carry
    // tokens/secrets to log), so this is the only trail for this action —
    // deliberately no password material, hashed or otherwise, in newData.
    await this.auditService.record({
      userId: invite.user.id,
      affectedTable: 'users',
      recordId: invite.user.id,
      action: AuditAction.UPDATE,
      oldData: null,
      newData: { passwordSet: true },
    });
  }
}
