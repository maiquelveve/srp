import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { PasswordHasherService } from './hashing/password-hasher.service';
import { TokenService } from './token.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { LoginResponseDto } from './dto/login-response.dto';
import { User } from '../users/entities/user.entity';

const GENERIC_LOGIN_ERROR = 'Credenciais inválidas';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmailForAuth(email);

    if (!user || !user.active) {
      await this.recordLoginAttempt(null, AuditAction.LOGIN_FAILED, email);
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const passwordValid = await this.passwordHasher.verify(user.passwordHash, password);
    if (!passwordValid) {
      await this.recordLoginAttempt(user.id, AuditAction.LOGIN_FAILED, email);
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const { accessToken, refreshToken } = await this.tokenService.issueTokenPair(user);
    await this.recordLoginAttempt(user.id, AuditAction.LOGIN, email);

    return this.toLoginResponse(user, accessToken, refreshToken);
  }

  async refresh(refreshToken: string): Promise<LoginResponseDto> {
    const { pair, user } = await this.tokenService.rotateRefreshToken(refreshToken);
    return this.toLoginResponse(user, pair.accessToken, pair.refreshToken);
  }

  async logout(refreshToken: string, userId: number | null): Promise<void> {
    await this.tokenService.revokeRefreshToken(refreshToken);
    await this.auditService.record({
      userId,
      affectedTable: 'users',
      recordId: userId,
      action: AuditAction.LOGOUT,
      oldData: null,
      newData: null,
    });
  }

  async setInitialPassword(inviteToken: string, password: string): Promise<void> {
    await this.usersService.setInitialPassword(inviteToken, password);
  }

  private async recordLoginAttempt(
    userId: number | null,
    action: AuditAction.LOGIN | AuditAction.LOGIN_FAILED,
    email: string,
  ): Promise<void> {
    await this.auditService.record({
      userId,
      affectedTable: 'users',
      recordId: userId,
      action,
      oldData: null,
      newData: { email },
    });
  }

  private toLoginResponse(user: User, accessToken: string, refreshToken: string): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.accessToken = accessToken;
    dto.refreshToken = refreshToken;
    dto.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      badgeNumber: user.badgeNumber,
      jobTitle: user.jobTitle,
      role: user.role.name,
      units: (user.units ?? []).map((unit) => unit.id),
    };
    return dto;
  }
}
