import { Module } from '@nestjs/common';
import { PasswordHasherService } from './password-hasher.service';

/**
 * Split out from AuthModule to avoid a circular import: UsersModule needs
 * password hashing, and AuthModule needs UsersModule (to look up users for
 * login).
 */
@Module({
  providers: [PasswordHasherService],
  exports: [PasswordHasherService],
})
export class AuthHashingModule {}
