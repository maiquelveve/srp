import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SetInitialPasswordDto } from './dto/set-initial-password.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { Public } from '../common/decorators/public.decorator';
import { SkipAutoAudit } from '../common/decorators/skip-auto-audit.decorator';
import { JwtPayload } from './types/jwt-payload.type';
import loadConfiguration from '../config/configuration';

/**
 * contracts/auth.md — base auth for every other module.
 * @SkipAutoAudit() at class level: every response here carries a live
 * access/refresh token — the generic AuditInterceptor must never log these
 * bodies raw. AuthService already writes safe, minimal audit entries itself
 * for LOGIN/LOGIN_FAILED/LOGOUT.
 */
@ApiTags('auth')
@Controller('api/v1/auth')
@SkipAutoAudit()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: () => loadConfiguration().throttle.loginLimit, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Autentica com e-mail e senha e devolve os tokens de acesso e de renovação',
  })
  @Post('login')
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renova o token de acesso com um token de renovação válido' })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<LoginResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Encerra a sessão revogando o token de renovação' })
  @ApiOkResponse({
    schema: { properties: { message: { type: 'string', example: 'Sessão encerrada' } } },
  })
  @Post('logout')
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request & { user?: JwtPayload },
  ): Promise<{ message: string }> {
    await this.authService.logout(dto.refreshToken, request.user?.sub ?? null);
    return { message: 'Sessão encerrada' };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Define a senha inicial de um usuário recém-cadastrado a partir do convite',
  })
  @ApiOkResponse({
    schema: { properties: { message: { type: 'string', example: 'Senha definida com sucesso' } } },
  })
  @Post('set-initial-password')
  async setInitialPassword(@Body() dto: SetInitialPasswordDto): Promise<{ message: string }> {
    await this.authService.setInitialPassword(dto.inviteToken, dto.password);
    return { message: 'Senha definida com sucesso' };
  }
}
