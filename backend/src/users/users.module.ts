import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { InviteToken } from './entities/invite-token.entity';
import { Role } from '../roles/entities/role.entity';
import { Unit } from '../units/entities/unit.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthHashingModule } from '../auth/hashing/auth-hashing.module';
import { TokenModule } from '../auth/token.module';
import { EmailModule } from '../email/email.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, InviteToken, Role, Unit]),
    AuthHashingModule,
    TokenModule,
    EmailModule,
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
