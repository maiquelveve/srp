import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { APP_CONFIG } from '../config/app-config.module';
import { AppConfig } from '../config/configuration';

const SUBJECT_BY_KIND: Record<'created' | 'reset', string> = {
  created: 'Bem-vindo(a) ao SRP. Defina sua senha de acesso',
  reset: 'SRP: redefinição de senha',
};

/**
 * Envia por e-mail o segredo de acesso do usuário — que é um significado
 * diferente por `kind` (research.md #6): `'created'` é o token bruto do
 * convite emitido por `UsersService.create()` (usado em
 * `POST /auth/set-initial-password` para definir a senha real, research.md
 * #10); `'reset'` é a própria senha temporária, já ativa, gerada por
 * `UsersService.resetPassword()` (research.md #7) — funciona direto num
 * login normal, sem passo de confirmação separado.
 *
 * Nunca lança exceção — falha de envio é capturada e reportada como
 * `false`, para a operação de negócio (criar/resetar usuário) continuar
 * mesmo assim (FR-002a/FR-007a).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.transporter = createTransport({
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      auth: this.config.smtp.user
        ? { user: this.config.smtp.user, pass: this.config.smtp.password }
        : undefined,
    });
  }

  async sendPasswordEmail(
    to: string,
    temporaryPassword: string,
    kind: 'created' | 'reset',
  ): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: this.config.smtp.from,
        to,
        subject: SUBJECT_BY_KIND[kind],
        text: this.buildBody(temporaryPassword, kind),
      });
      return true;
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail de senha para ${to}`, error as Error);
      return false;
    }
  }

  private buildBody(temporaryPassword: string, kind: 'created' | 'reset'): string {
    if (kind === 'created') {
      return `Uma conta foi criada para você no SRP.\n\nUse o código abaixo para definir sua senha de acesso:\n\n${temporaryPassword}\n\nEsse código é de uso único e expira em breve.`;
    }
    return `A senha da sua conta no SRP foi redefinida.\n\nSua nova senha temporária é:\n\n${temporaryPassword}\n\nUse-a para entrar e, em seguida, altere-a pelo seu perfil.`;
  }
}
