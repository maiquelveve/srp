import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SetInitialPasswordDto } from './dto/set-initial-password.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtPayload } from './types/jwt-payload.type';

/** contracts/auth.md — base auth for every other module. */
@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<LoginResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
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
  @Post('set-initial-password')
  async setInitialPassword(@Body() dto: SetInitialPasswordDto): Promise<{ message: string }> {
    await this.authService.setInitialPassword(dto.inviteToken, dto.password);
    return { message: 'Senha definida com sucesso' };
  }
}
