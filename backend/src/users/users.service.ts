import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { User } from './entities/user.entity';
import { InviteToken } from './entities/invite-token.entity';
import { Role } from '../roles/entities/role.entity';
import { Unit } from '../units/entities/unit.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ReplaceUnitsDto } from './dto/replace-units.dto';
import { AddUnitsDto } from './dto/add-units.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PasswordActionResponseDto } from './dto/password-action-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PasswordHasherService } from '../auth/hashing/password-hasher.service';
import { TokenService } from '../auth/token.service';
import { EmailService } from '../email/email.service';
import { assertUnitScope } from '../auth/unit-scope.util';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

const USER_RELATIONS = { role: true, units: true } as const;
const INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** GET /users sem `limit` explícito (tela de Administração de Usuários). */
const DEFAULT_LIST_LIMIT = 20;
/** FR-006/FR-006a novo (pedido do usuário) — nenhum usuário pode ter mais de 3 lotações ao mesmo tempo. */
const MAX_UNITS_PER_USER = 3;
const TOO_MANY_UNITS_MESSAGE = `Um usuário pode ter no máximo ${MAX_UNITS_PER_USER} lotações simultâneas`;
const UNIQUE_VIOLATION_CODE = '23505';
const DUPLICATE_EMAIL_MESSAGE = 'Já existe um usuário com este e-mail';
const DUPLICATE_BADGE_MESSAGE = 'Já existe um usuário com esta matrícula';
/** FR-008a — mensagem única para as 4 ações proibidas sobre a própria conta. */
const SELF_TARGET_MESSAGE = 'Apenas outra Chefia/Diretor pode fazer essa alteração';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    @InjectRepository(Unit) private readonly unitRepository: Repository<Unit>,
    @InjectRepository(InviteToken)
    private readonly inviteTokenRepository: Repository<InviteToken>,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
  ) {}

  /** Includes passwordHash — internal use only (AuthService), never returned by an API. */
  async findByEmailForAuth(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email }, relations: USER_RELATIONS });
  }

  async findByIdForAuth(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id }, relations: USER_RELATIONS });
  }

  /**
   * Persists a new password hash — used by AuthService.changePassword()
   * (contracts/auth.md). Also stamps `passwordChangedAt` so `JwtStrategy`
   * rejects any access token already issued before this call on its next
   * use (FR-017a) — revoking just the refresh token leaves a still-valid
   * access token usable elsewhere for up to its own TTL otherwise.
   */
  async updatePassword(id: number, passwordHash: string): Promise<void> {
    await this.userRepository.update({ id }, { passwordHash, passwordChangedAt: new Date() });
  }

  /** Lightweight per-request check used by the JWT strategy (FR-031, FR-017a). */
  async findAuthGuardData(
    id: number,
  ): Promise<{ active: boolean; passwordChangedAt: Date | null } | null> {
    return this.userRepository.findOne({
      where: { id },
      select: { active: true, passwordChangedAt: true },
    });
  }

  async list(
    query: ListUsersQueryDto,
    callerUnitIds: number[],
    callerUserId: number,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    // Só decide QUEM entra na página (ids + total) — o `unit` aqui é usado
    // exclusivamente para filtrar, nunca é selecionado. Fazer o filtro de
    // escopo (FR-004a) num `leftJoinAndSelect` (como antes) truncava
    // `user.units` na resposta: um usuário com units [A, B] só vinha com A
    // se o requisitante só tivesse A no escopo, mesmo tendo lotação em B
    // também — bug pré-existente, mais visível agora que o card mostra a
    // lotação completa do usuário.
    const idsQuery = this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.units', 'scopeUnit')
      .leftJoin('user.role', 'role')
      // Every listing MUST stay scoped to the caller's units (FR-004a), even with no explicit filter.
      .where('scopeUnit.id IN (:...callerUnitIds)', { callerUnitIds })
      // Nunca lista o próprio requisitante — editar a própria conta é
      // resolvido pela tela de perfil, não por esta administração.
      .andWhere('user.id != :callerUserId', { callerUserId })
      .select('user.id')
      .distinct(true);

    if (query.role) {
      idsQuery.andWhere('role.name = :role', { role: query.role });
    }
    if (query.unitId) {
      assertUnitScope(callerUnitIds, [query.unitId]);
      idsQuery.andWhere('scopeUnit.id = :unitId', { unitId: query.unitId });
    }
    if (query.active !== undefined) {
      idsQuery.andWhere('user.active = :active', { active: query.active === 'true' });
    }
    if (query.search) {
      idsQuery.andWhere(
        '(user.name ILIKE :search OR user.email ILIKE :search OR user.badgeNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // `.clone()` antes de paginar: `getCount()` na MESMA instância que já
    // recebeu `.take()/.skip()` conta só a página atual, não o total real
    // (TypeORM aplica LIMIT/OFFSET em `getCount()` também quando presentes).
    const total = await idsQuery.clone().getCount();
    // `.limit()/.offset()` (SQL puro), não `.take()/.skip()` — estes são
    // "cientes de entidade" (pensados pra getMany() com joins de relação) e,
    // combinados com `.select()`/`.distinct()` + `getRawMany()`, o TypeORM
    // não os traduz em LIMIT/OFFSET nenhum (SQL sai sem paginação alguma).
    const rows = await idsQuery
      .orderBy('user.id', 'ASC')
      .limit(query.limit ?? DEFAULT_LIST_LIMIT)
      .offset(query.offset ?? 0)
      .getRawMany<{ user_id: number }>();
    const ids = rows.map((row) => row.user_id);

    if (ids.length === 0) {
      return new PaginatedResponseDto([], total);
    }

    // Segunda consulta, sem nenhum filtro de escopo no join — carrega TODAS
    // as unidades de cada usuário da página, não só as que batem no escopo.
    const users = await this.userRepository.find({
      where: { id: In(ids) },
      relations: USER_RELATIONS,
    });
    const userById = new Map(users.map((u) => [u.id, u]));
    const ordered = ids.map((id) => userById.get(id)).filter((u): u is User => u !== undefined);

    return new PaginatedResponseDto(
      ordered.map((u) => UserResponseDto.fromEntity(u)),
      total,
    );
  }

  async create(dto: CreateUserDto, callerUnitIds: number[]): Promise<UserResponseDto> {
    assertUnitScope(callerUnitIds, dto.unitIds);
    if (dto.unitIds.length > MAX_UNITS_PER_USER) {
      throw new BadRequestException(TOO_MANY_UNITS_MESSAGE);
    }

    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(DUPLICATE_EMAIL_MESSAGE);
    }
    if (dto.badgeNumber) {
      const sameBadge = await this.userRepository.findOne({
        where: { badgeNumber: dto.badgeNumber },
      });
      if (sameBadge) {
        throw new ConflictException(DUPLICATE_BADGE_MESSAGE);
      }
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

    const user = await this.persistUser(
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

    const rawToken = await this.issueInviteToken(user);
    const emailDelivered = await this.emailService.sendPasswordEmail(
      user.email,
      rawToken,
      'created',
    );

    const response = UserResponseDto.fromEntity(user);
    response.emailDelivered = emailDelivered;
    return response;
  }

  async update(id: number, dto: UpdateUserDto, actingUserId: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id }, relations: USER_RELATIONS });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // FR-008a — editar é permitido sobre a própria conta, exceto trocar o próprio perfil.
    if (id === actingUserId && dto.role !== undefined && dto.role !== user.role.name) {
      throw new ForbiddenException(SELF_TARGET_MESSAGE);
    }

    // E-mail errado no cadastro (ex.: digitado errado na criação) precisa ter
    // conserto sem deixar o registro antigo órfão no banco — daí ser editável
    // aqui, com a mesma checagem de duplicidade de create().
    if (dto.email !== undefined && dto.email !== user.email) {
      const sameEmail = await this.userRepository.findOne({ where: { email: dto.email } });
      if (sameEmail) {
        throw new ConflictException(DUPLICATE_EMAIL_MESSAGE);
      }
    }

    const oldData = { ...user, role: user.role.name, units: user.units.map((u) => u.id) };

    if (dto.name !== undefined) {
      user.name = dto.name;
    }
    if (dto.email !== undefined) {
      user.email = dto.email;
    }
    if (dto.badgeNumber !== undefined) {
      user.badgeNumber = dto.badgeNumber;
    }
    if (dto.jobTitle !== undefined) {
      user.jobTitle = dto.jobTitle;
    }
    if (dto.role !== undefined) {
      const role = await this.roleRepository.findOne({ where: { name: dto.role } });
      if (!role) {
        throw new NotFoundException('Perfil inválido');
      }
      user.role = role;
    }

    const saved = await this.persistUser(user);

    await this.auditService.record({
      userId: actingUserId,
      affectedTable: 'users',
      recordId: saved.id,
      action: AuditAction.UPDATE,
      oldData,
      newData: {
        ...oldData,
        name: saved.name,
        email: saved.email,
        badgeNumber: saved.badgeNumber,
        jobTitle: saved.jobTitle,
        role: saved.role.name,
      },
    });

    return UserResponseDto.fromEntity(saved);
  }

  async reactivate(id: number, actingUserId: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id }, relations: USER_RELATIONS });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const oldData = { ...user, role: user.role.name, units: user.units.map((u) => u.id) };
    user.active = true;
    await this.userRepository.save(user);

    await this.auditService.record({
      userId: actingUserId,
      affectedTable: 'users',
      recordId: user.id,
      action: AuditAction.UPDATE,
      oldData: { ...oldData, active: false },
      newData: { ...oldData, active: true },
    });

    return UserResponseDto.fromEntity(user);
  }

  async deactivate(id: number, actingUserId: number): Promise<UserResponseDto> {
    // FR-008a — desativar a própria conta exige outra Chefia/Diretor.
    if (id === actingUserId) {
      throw new ForbiddenException(SELF_TARGET_MESSAGE);
    }

    const user = await this.userRepository.findOne({ where: { id }, relations: USER_RELATIONS });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const oldData = { ...user, role: user.role.name, units: user.units.map((u) => u.id) };
    user.active = false;
    await this.userRepository.save(user);
    // FR-031 — no session may outlive the deactivation.
    await this.tokenService.revokeAllForUser(user.id);

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

  /** "Trocar lotação" (FR-006) — substitui integralmente as unidades do usuário. */
  async replaceUnits(
    id: number,
    dto: ReplaceUnitsDto,
    actingUserId: number,
  ): Promise<UserResponseDto> {
    // FR-008a — sempre proibido sobre a própria conta, sem sub-caso permitido.
    if (id === actingUserId) {
      throw new ForbiddenException(SELF_TARGET_MESSAGE);
    }
    if (dto.unitIds.length > MAX_UNITS_PER_USER) {
      throw new BadRequestException(TOO_MANY_UNITS_MESSAGE);
    }

    const user = await this.userRepository.findOne({ where: { id }, relations: USER_RELATIONS });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const units = await this.unitRepository.find({ where: { id: In(dto.unitIds) } });
    if (units.length !== dto.unitIds.length) {
      throw new NotFoundException('Uma ou mais unidades não encontradas');
    }

    const oldData = { ...user, role: user.role.name, units: user.units.map((u) => u.id) };
    user.units = units;
    await this.userRepository.save(user);

    await this.auditService.record({
      userId: actingUserId,
      affectedTable: 'users',
      recordId: user.id,
      action: AuditAction.UPDATE,
      oldData,
      newData: { ...oldData, units: units.map((u) => u.id) },
    });

    return UserResponseDto.fromEntity(user);
  }

  /** "Adicionar lotação" (FR-006a) — soma unidades novas às já vinculadas, sem remover nenhuma. */
  async addUnits(id: number, dto: AddUnitsDto, actingUserId: number): Promise<UserResponseDto> {
    // FR-008a — sempre proibido sobre a própria conta, sem sub-caso permitido.
    if (id === actingUserId) {
      throw new ForbiddenException(SELF_TARGET_MESSAGE);
    }

    const user = await this.userRepository.findOne({ where: { id }, relations: USER_RELATIONS });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const newUnits = await this.unitRepository.find({ where: { id: In(dto.unitIds) } });
    if (newUnits.length !== dto.unitIds.length) {
      throw new NotFoundException('Uma ou mais unidades não encontradas');
    }

    const oldData = { ...user, role: user.role.name, units: user.units.map((u) => u.id) };
    const existingUnitIds = new Set(user.units.map((unit) => unit.id));
    const mergedUnits = [
      ...user.units,
      ...newUnits.filter((unit) => !existingUnitIds.has(unit.id)),
    ];
    if (mergedUnits.length > MAX_UNITS_PER_USER) {
      throw new BadRequestException(TOO_MANY_UNITS_MESSAGE);
    }
    user.units = mergedUnits;
    await this.userRepository.save(user);

    await this.auditService.record({
      userId: actingUserId,
      affectedTable: 'users',
      recordId: user.id,
      action: AuditAction.UPDATE,
      oldData,
      newData: { ...oldData, units: mergedUnits.map((u) => u.id) },
    });

    return UserResponseDto.fromEntity(user);
  }

  /**
   * FR-007 — gera uma senha temporária de verdade (mesma política de
   * `ChangePasswordDto`/`SetInitialPasswordDto`, research.md #7) e já a
   * define como a senha atual do usuário: diferente de create() (que usa o
   * fluxo de convite, research.md #10), aqui não há passo de confirmação
   * separado — a senha enviada por e-mail já funciona para o próximo login,
   * exatamente como o texto do FR pede.
   */
  async resetPassword(id: number, actingUserId: number): Promise<PasswordActionResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    user.passwordHash = await this.passwordHasher.hash(temporaryPassword);
    // FR-007 — nenhuma sessão sobrevive ao reset: revogar só o refresh token
    // não bastaria, um access token ainda válido continuaria passando em
    // JwtStrategy até expirar sozinho (mesmo motivo de updatePassword()).
    user.passwordChangedAt = new Date();
    await this.userRepository.save(user);

    await this.tokenService.revokeAllForUser(user.id);

    const emailDelivered = await this.emailService.sendPasswordEmail(
      user.email,
      temporaryPassword,
      'reset',
    );

    await this.auditService.record({
      userId: actingUserId,
      affectedTable: 'users',
      recordId: user.id,
      action: AuditAction.UPDATE,
      oldData: null,
      newData: { passwordReset: true, emailDelivered },
    });

    return this.toPasswordActionResponse(
      emailDelivered,
      'Senha redefinida e enviada por e-mail',
      'Senha redefinida, mas o e-mail não pôde ser entregue',
    );
  }

  /**
   * FR-002a/FR-007a — reenvia a senha (inicial ou de reset) ainda pendente.
   * "Pendente" só é rastreável de forma confiável para o convite inicial
   * (`InviteToken.usedAt`, definido por `setInitialPassword()`) — um reset
   * não grava marca própria de "senha ainda não trocada" (nenhuma coluna
   * nova nesta fase, data-model.md). Por isso, sem convite inicial pendente,
   * reenviar equivale a gerar um novo reset (o valor da senha temporária
   * anterior não fica salvo em claro, só o hash, então não há como
   * literalmente reenviar "a mesma"): mais seguro reenviar de mais do que
   * negar um reenvio legítimo logo após uma falha real de e-mail.
   */
  async resendPasswordEmail(id: number, actingUserId: number): Promise<PasswordActionResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const latestInvite = await this.inviteTokenRepository.findOne({
      where: { user: { id: user.id } },
      order: { id: 'DESC' },
    });

    if (!latestInvite) {
      throw new ConflictException('Não há senha pendente para reenviar');
    }

    if (!latestInvite.usedAt) {
      const rawToken = await this.issueInviteToken(user);
      const emailDelivered = await this.emailService.sendPasswordEmail(
        user.email,
        rawToken,
        'created',
      );

      await this.auditService.record({
        userId: actingUserId,
        affectedTable: 'users',
        recordId: user.id,
        action: AuditAction.UPDATE,
        oldData: null,
        newData: { passwordEmailResent: true, emailDelivered },
      });

      return this.toPasswordActionResponse(
        emailDelivered,
        'E-mail reenviado com sucesso',
        'Não foi possível reenviar o e-mail',
      );
    }

    return this.resetPassword(id, actingUserId);
  }

  /** Mesma política de `ChangePasswordDto`/`SetInitialPasswordDto` (research.md #7, MinLength 8). */
  private generateTemporaryPassword(): string {
    return randomBytes(9).toString('base64url');
  }

  private toPasswordActionResponse(
    emailDelivered: boolean,
    deliveredMessage: string,
    failedMessage: string,
  ): PasswordActionResponseDto {
    const dto = new PasswordActionResponseDto();
    dto.emailDelivered = emailDelivered;
    dto.message = emailDelivered ? deliveredMessage : failedMessage;
    return dto;
  }

  /** A concurrent request can slip past the pre-checks; the unique constraints are the real guard (409, never 500). */
  private async persistUser(user: User): Promise<User> {
    try {
      return await this.userRepository.save(user);
    } catch (error) {
      const driverError = (error as QueryFailedError).driverError as
        { code?: string; detail?: string } | undefined;
      if (error instanceof QueryFailedError && driverError?.code === UNIQUE_VIOLATION_CODE) {
        throw new ConflictException(
          driverError.detail?.includes('badge_number')
            ? DUPLICATE_BADGE_MESSAGE
            : DUPLICATE_EMAIL_MESSAGE,
        );
      }
      throw error;
    }
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
