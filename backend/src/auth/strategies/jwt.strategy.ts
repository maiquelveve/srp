import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt-payload.type';
import { APP_CONFIG } from '../../config/app-config.module';
import { AppConfig } from '../../config/configuration';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
    });
  }

  /**
   * FR-031 — a deactivated user loses access immediately, even with an
   * unexpired token. FR-017a/FR-007 — same for a token issued before the
   * user's last password change (self change or admin reset): revoking
   * just the refresh token isn't enough, this access token would otherwise
   * keep working elsewhere until it expires on its own (up to
   * `JWT_ACCESS_EXPIRES_IN`, 15 min by default).
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersService.findAuthGuardData(payload.sub);
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuário desativado');
    }
    if (
      user.passwordChangedAt &&
      payload.iat !== undefined &&
      // `iat` só tem resolução de segundo inteiro (floor), enquanto
      // `passwordChangedAt` tem milissegundos — comparar direto rejeitaria
      // até um token emitido DEPOIS da troca, se caísse no mesmo segundo
      // (o novo `iat`, arredondado pra baixo, podia marcar um instante
      // anterior ao `passwordChangedAt` daquele mesmo segundo). Arredondar
      // os dois lados pro mesmo segundo evita esse falso positivo; o custo é
      // só não barrar um token emitido até ~1s antes da troca, dentro do
      // mesmo segundo — janela desprezível perto do objetivo (FR-017a).
      payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      throw new UnauthorizedException('Sessão encerrada: a senha foi alterada');
    }
    return payload;
  }
}
