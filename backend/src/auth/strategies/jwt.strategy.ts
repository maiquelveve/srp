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

  /** FR-031 — a deactivated user loses access immediately, even with an unexpired token. */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!(await this.usersService.isActive(payload.sub))) {
      throw new UnauthorizedException('Usuário desativado');
    }
    return payload;
  }
}
