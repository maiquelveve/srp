import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { IsNull, Not, ObjectLiteral, Repository } from 'typeorm';
import { TokenService } from '../../src/auth/token.service';
import { RefreshToken } from '../../src/users/entities/refresh-token.entity';
import { APP_CONFIG } from '../../src/config/app-config.module';

type MockRepository<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

function createMockRepository<T extends ObjectLiteral>(): MockRepository<T> {
  return {
    update: jest.fn(),
  };
}

/**
 * research.md #1 — TokenService.revokeAllForUser() is the single reusable
 * place any action that must not let a session survive (deactivation,
 * admin password reset, self password change) goes through.
 */
describe('TokenService.revokeAllForUser', () => {
  let service: TokenService;
  let refreshTokenRepository: MockRepository<RefreshToken>;

  beforeEach(async () => {
    refreshTokenRepository = createMockRepository<RefreshToken>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: {} },
        { provide: APP_CONFIG, useValue: { jwt: {} } },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshTokenRepository },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  it('revokes every still-valid refresh token of the user when no exception is given', async () => {
    await service.revokeAllForUser(7);

    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      { user: { id: 7 }, revokedAt: IsNull() },
      { revokedAt: expect.any(Date) as Date },
    );
  });

  it('revokes every token except the one matching exceptTokenHash', async () => {
    await service.revokeAllForUser(7, 'kept-hash');

    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      { user: { id: 7 }, revokedAt: IsNull(), tokenHash: Not('kept-hash') },
      { revokedAt: expect.any(Date) as Date },
    );
  });
});
