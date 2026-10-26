import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { readFileSync } from 'node:fs';
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';

const INVALID_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private messaging: Messaging | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  onModuleInit(): void {
    const credential = this.loadCredential();

    if (!credential) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_PATH/JSON não configurado: push desativado.',
      );
      return;
    }

    const app = getApps().length
      ? getApp()
      : initializeApp({ credential: cert(credential) });
    this.messaging = getMessaging(app);
  }

  async sendToUser(
    userId: Types.ObjectId | string,
    payload: PushPayload,
  ): Promise<void> {
    if (!this.messaging) return;

    const user = await this.userModel
      .findOne({ _id: userId, deletedAt: null })
      .select('fcmTokens')
      .exec();
    const tokens = user?.fcmTokens ?? [];
    if (tokens.length === 0) return;

    const response = await this.messaging.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      android: { priority: 'high', notification: { sound: 'default' } },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: { aps: { sound: 'default' } },
      },
    });

    const invalidTokens = response.responses
      .map((result, index) => ({ result, token: tokens[index] }))
      .filter(
        ({ result }) =>
          !result.success &&
          result.error &&
          INVALID_TOKEN_CODES.includes(result.error.code),
      )
      .map(({ token }) => token);

    if (invalidTokens.length > 0) {
      await this.userModel
        .updateOne(
          { _id: userId },
          { $pull: { fcmTokens: { $in: invalidTokens } } },
        )
        .exec();
    }
  }

  private loadCredential(): ServiceAccount | null {
    const json = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    if (json) {
      return JSON.parse(json) as ServiceAccount;
    }

    const path = this.configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_PATH',
    );
    if (path) {
      return JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount;
    }

    return null;
  }
}
