import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { InviteToken } from './entities/invite-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Role } from '../roles/entities/role.entity';
import { Unit } from '../units/entities/unit.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthHashingModule } from '../auth/hashing/auth-hashing.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, InviteToken, RefreshToken, Role, Unit]),
    AuthHashingModule,
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
