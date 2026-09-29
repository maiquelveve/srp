import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthHashingModule } from './hashing/auth-hashing.module';
import { AuditModule } from '../audit/audit.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenModule } from './token.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, UsersModule, AuthHashingModule, AuditModule, TokenModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [TokenModule],
})
export class AuthModule {}
