import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from '../../src/email/email.service';
import { APP_CONFIG } from '../../src/config/app-config.module';

const sendMailMock = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

/**
 * research.md #6 — EmailService never throws to the caller; a delivery
 * failure is reported as `false` so UsersService can still complete the
 * create/reset operation (FR-002a/FR-007a).
 */
describe('EmailService.sendPasswordEmail', () => {
  let service: EmailService;

  beforeEach(async () => {
    sendMailMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: APP_CONFIG,
          useValue: {
            smtp: {
              host: 'localhost',
              port: 587,
              secure: false,
              user: '',
              password: '',
              from: 'no-reply@srp.rs.gov.br',
            },
          },
        },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('returns true when the SMTP send succeeds', async () => {
    sendMailMock.mockResolvedValueOnce(undefined);

    const delivered = await service.sendPasswordEmail(
      'user@test.srp.rs.gov.br',
      'token-abc',
      'created',
    );

    expect(delivered).toBe(true);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'user@test.srp.rs.gov.br', from: 'no-reply@srp.rs.gov.br' }),
    );
  });

  it('returns false, without throwing, when the SMTP send fails', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('connection refused'));

    const delivered = await service.sendPasswordEmail(
      'user@test.srp.rs.gov.br',
      'token-abc',
      'reset',
    );

    expect(delivered).toBe(false);
  });
});
