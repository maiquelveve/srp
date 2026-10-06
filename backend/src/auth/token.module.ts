import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { TokenService } from './token.service';

/**
 * Split out from AuthModule to avoid a circular import: UsersModule needs
 * TokenService (to revoke sessions on deactivate/reset, research.md #1), and
 * AuthModule needs UsersModule (to look up users for login) — same shape as
 * AuthHashingModule (auth/hashing/auth-hashing.module.ts).
 */
@Module({
  imports: [TypeOrmModule.forFeature([RefreshToken]), JwtModule.register({})],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
