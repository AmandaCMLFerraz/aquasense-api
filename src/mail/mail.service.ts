import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface CodeEmailParams {
  title: string;
  greeting: string;
  message: string;
  code: string;
  footer: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.from =
      this.configService.get<string>('MAIL_FROM') ??
      'AquaSense <onboarding@resend.dev>';
  }

  async sendAccountActivationEmail(
    to: string,
    name: string,
    code: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: 'Confirme sua conta AquaSense',
      html: this.renderCodeEmail({
        title: 'Confirme seu e-mail',
        greeting: `Olá, ${name}!`,
        message: 'Use o código abaixo para ativar sua conta no AquaSense:',
        code,
        footer: 'Se você não criou uma conta, ignore este e-mail.',
      }),
    });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    code: string,
  ): Promise<void> {
    await this.send({
      to,
      subject: 'Recuperação de senha - AquaSense',
      html: this.renderCodeEmail({
        title: 'Recuperação de senha',
        greeting: `Olá, ${name}!`,
        message: 'Use o código abaixo para redefinir sua senha:',
        code,
        footer: 'Se você não solicitou essa alteração, ignore este e-mail.',
      }),
    });
  }

  async sendNotificationEmail(
    to: string,
    subject: string,
    message: string,
  ): Promise<void> {
    await this.send({
      to,
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <p>${message}</p>
        </div>
      `,
    });
  }

  private async send(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      this.logger.error(
        `Falha ao enviar e-mail para ${params.to}: ${error.message}`,
      );
    }
  }

  private renderCodeEmail(params: CodeEmailParams): string {
    return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>${params.title}</h2>
        <p>${params.greeting}</p>
        <p>${params.message}</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center;">
          ${params.code}
        </p>
        <p style="color: #666; font-size: 12px;">${params.footer}</p>
      </div>
    `;
  }
}
