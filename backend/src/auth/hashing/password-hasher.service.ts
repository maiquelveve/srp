import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Argon2 password hashing (research.md #7 — chosen over bcrypt per docs/srp_plan.md). */
@Injectable()
export class PasswordHasherService {
  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword);
  }

  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    return argon2.verify(passwordHash, plainPassword);
  }
}
