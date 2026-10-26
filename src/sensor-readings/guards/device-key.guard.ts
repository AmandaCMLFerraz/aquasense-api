import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { isValidDeviceKey } from '../../common/utils/device-key';

@Injectable()
export class DeviceKeyGuard implements CanActivate {
  private readonly secret: string;

  constructor(configService: ConfigService) {
    this.secret = configService.getOrThrow<string>('DEVICE_KEY_SECRET');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const identifier = (request.body as { identifier?: unknown } | undefined)
      ?.identifier;
    const key = request.header('x-device-key');

    if (
      typeof identifier !== 'string' ||
      !key ||
      !isValidDeviceKey(this.secret, identifier, key)
    ) {
      throw new UnauthorizedException('Credenciais do dispositivo inválidas.');
    }

    return true;
  }
}
