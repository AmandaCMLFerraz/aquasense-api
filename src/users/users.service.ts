import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

export interface CreateUserInput {
  name: string;
  email: string;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(
    createUserInput: CreateUserInput,
    passwordHash: string,
  ): Promise<UserDocument> {
    const email = createUserInput.email.toLowerCase();
    const existing = await this.userModel.findOne({ email }).exec();

    if (existing) {
      if (!existing.deletedAt) {
        throw new ConflictException('Já existe um usuário com este e-mail.');
      }
      await this.userModel.deleteOne({ _id: existing._id }).exec();
    }

    return this.userModel.create({
      name: createUserInput.name,
      email,
      passwordHash,
      isEmailVerified: true,
    });
  }

  async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase(), deletedAt: null })
      .select('+passwordHash')
      .exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase(), deletedAt: null })
      .exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ _id: id, deletedAt: null })
      .exec();
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return user;
  }

  async findByIdWithRefreshToken(id: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ _id: id, deletedAt: null })
      .select('+hashedRefreshToken')
      .exec();
  }

  async setHashedRefreshToken(
    userId: string,
    hashedRefreshToken: string | null,
  ): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { hashedRefreshToken })
      .exec();
  }

  async setPasswordResetCode(
    userId: string,
    codeHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        { passwordResetCodeHash: codeHash, passwordResetExpires: expiresAt },
      )
      .exec();
  }

  async findByEmailWithPasswordResetCode(
    email: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase(), deletedAt: null })
      .select('+passwordResetCodeHash +passwordResetExpires')
      .exec();
  }

  async resetPassword(userId: string, passwordHash: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        {
          passwordHash,
          hashedRefreshToken: null,
          $unset: { passwordResetCodeHash: '', passwordResetExpires: '' },
        },
      )
      .exec();
  }

  async addFcmToken(userId: string, token: string): Promise<void> {
    await this.userModel
      .updateMany({ _id: { $ne: userId } }, { $pull: { fcmTokens: token } })
      .exec();
    await this.userModel
      .updateOne({ _id: userId }, { $addToSet: { fcmTokens: token } })
      .exec();
  }

  async removeFcmToken(userId: string, token: string): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { $pull: { fcmTokens: token } })
      .exec();
  }

  async softDelete(userId: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        { deletedAt: new Date(), hashedRefreshToken: null, fcmTokens: [] },
      )
      .exec();
  }
}
