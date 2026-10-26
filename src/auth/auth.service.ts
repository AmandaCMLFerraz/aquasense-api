import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { MailService } from '../mail/mail.service';
import { PendingRegistrationsService } from './pending-registrations.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

const PASSWORD_SALT_ROUNDS = 10;
const EMAIL_VERIFICATION_TTL_MINUTES = 30;
const PASSWORD_RESET_TTL_MINUTES = 15;
const INVALID_OR_EXPIRED_CODE_MESSAGE = 'Código inválido ou expirado.';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly pendingRegistrationsService: PendingRegistrationsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const email = registerDto.email.toLowerCase();

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(
      registerDto.password,
      PASSWORD_SALT_ROUNDS,
    );
    const code = this.generateNumericCode();
    const codeHash = await bcrypt.hash(code, PASSWORD_SALT_ROUNDS);
    const expiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
    );

    await this.pendingRegistrationsService.upsert({
      name: registerDto.name,
      email,
      passwordHash,
      codeHash,
      expiresAt,
    });

    await this.mailService.sendAccountActivationEmail(
      email,
      registerDto.name,
      code,
    );

    return {
      message: 'Enviamos um código de confirmação para o seu e-mail.',
    };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const pending = await this.pendingRegistrationsService.findByEmail(email);
    if (pending) {
      const code = this.generateNumericCode();
      const codeHash = await bcrypt.hash(code, PASSWORD_SALT_ROUNDS);
      const expiresAt = new Date(
        Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000,
      );
      await this.pendingRegistrationsService.updateCode(
        String(pending._id),
        codeHash,
        expiresAt,
      );
      await this.mailService.sendAccountActivationEmail(
        pending.email,
        pending.name,
        code,
      );
    }
    return {
      message:
        'Se houver um cadastro pendente para este e-mail, enviaremos um novo código.',
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const pending =
      await this.pendingRegistrationsService.findByEmailWithSecrets(dto.email);

    if (
      !pending ||
      pending.expiresAt < new Date() ||
      !(await bcrypt.compare(dto.code, pending.codeHash))
    ) {
      throw new BadRequestException(INVALID_OR_EXPIRED_CODE_MESSAGE);
    }

    await this.usersService.create(
      { name: pending.name, email: pending.email },
      pending.passwordHash,
    );
    await this.pendingRegistrationsService.deleteByEmail(pending.email);

    return { message: 'E-mail confirmado com sucesso. Faça login.' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (user) {
      const code = this.generateNumericCode();
      const codeHash = await bcrypt.hash(code, PASSWORD_SALT_ROUNDS);
      const expiresAt = new Date(
        Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
      );
      await this.usersService.setPasswordResetCode(
        String(user._id),
        codeHash,
        expiresAt,
      );
      await this.mailService.sendPasswordResetEmail(
        user.email,
        user.name,
        code,
      );
    }

    return {
      message:
        'Se o e-mail existir em nossa base, enviaremos um código de recuperação.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmailWithPasswordResetCode(
      dto.email,
    );

    if (
      !user?.passwordResetCodeHash ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new BadRequestException(INVALID_OR_EXPIRED_CODE_MESSAGE);
    }

    const codeMatches = await bcrypt.compare(
      dto.code,
      user.passwordResetCodeHash,
    );
    if (!codeMatches) {
      throw new BadRequestException(INVALID_OR_EXPIRED_CODE_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      PASSWORD_SALT_ROUNDS,
    );
    await this.usersService.resetPassword(String(user._id), passwordHash);

    return { message: 'Senha atualizada com sucesso.' };
  }

  async login(loginDto: LoginDto): Promise<{ user: PublicUser } & AuthTokens> {
    const user = await this.usersService.findByEmailWithPassword(
      loginDto.email,
    );
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const tokens = await this.issueTokens(user);
    await this.updateRefreshTokenHash(String(user._id), tokens.refreshToken);

    return { user: this.toPublicUser(user), ...tokens };
  }

  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<AuthTokens> {
    const user = await this.usersService.findByIdWithRefreshToken(userId);
    if (!user || !user.hashedRefreshToken) {
      throw new ForbiddenException('Acesso negado.');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );
    if (!refreshTokenMatches) {
      throw new ForbiddenException('Acesso negado.');
    }

    const tokens = await this.issueTokens(user);
    await this.updateRefreshTokenHash(String(user._id), tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setHashedRefreshToken(userId, null);
  }

  private async issueTokens(user: UserDocument): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: String(user._id), email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as JwtSignOptions['expiresIn'],
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshTokenHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(
      refreshToken,
      PASSWORD_SALT_ROUNDS,
    );
    await this.usersService.setHashedRefreshToken(userId, hashedRefreshToken);
  }

  private toPublicUser(user: UserDocument): PublicUser {
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
    };
  }

  private generateNumericCode(): string {
    return randomInt(100000, 1000000).toString();
  }
}
