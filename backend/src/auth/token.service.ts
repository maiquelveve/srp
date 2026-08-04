import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { JwtPayload } from './types/jwt-payload.type';
import { APP_CONFIG } from '../config/app-config.module';
import { AppConfig } from '../config/configuration';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues/rotates/revokes JWT access+refresh token pairs. Refresh tokens are
 * signed JWTs (so expiry/signature are cheap to check) AND persisted as a
 * SHA-256 hash in `refresh_tokens` so logout can actually revoke them
 * (research.md #11, /speckit-analyze finding G3).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildPayload(user: User): JwtPayload {
    return {
      sub: user.id,
      role: user.role.name,
      units: (user.units ?? []).map((unit) => unit.id),
    };
  }

  async issueTokenPair(user: User): Promise<TokenPair> {
    const payload = this.buildPayload(user);

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: this.config.jwt.accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, jti: randomUUID() },
      {
        secret: this.config.jwt.refreshSecret,
        expiresIn: this.config.jwt.refreshExpiresIn,
      },
    );

    const decoded = this.jwtService.decode(refreshToken) as { exp: number };
    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        user,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
        revokedAt: null,
      }),
    );

    return { accessToken, refreshToken };
  }

  /** Verifies, revokes the used token, and issues a new pair (rotation). */
  async rotateRefreshToken(refreshToken: string): Promise<{ pair: TokenPair; user: User }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.jwt.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }
    void payload;

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: { user: { role: true, units: true } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    stored.revokedAt = new Date();
    await this.refreshTokenRepository.save(stored);

    const pair = await this.issueTokenPair(stored.user);
    return { pair, user: stored.user };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokenRepository.update({ tokenHash }, { revokedAt: new Date() });
  }
}
