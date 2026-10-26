import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PendingRegistration,
  PendingRegistrationDocument,
} from './schemas/pending-registration.schema';

export interface UpsertPendingRegistrationInput {
  name: string;
  email: string;
  passwordHash: string;
  codeHash: string;
  expiresAt: Date;
}

@Injectable()
export class PendingRegistrationsService {
  constructor(
    @InjectModel(PendingRegistration.name)
    private readonly pendingRegistrationModel: Model<PendingRegistrationDocument>,
  ) {}

  async upsert(
    input: UpsertPendingRegistrationInput,
  ): Promise<PendingRegistrationDocument> {
    const email = input.email.toLowerCase();
    return this.pendingRegistrationModel
      .findOneAndUpdate(
        { email },
        {
          name: input.name,
          email,
          passwordHash: input.passwordHash,
          codeHash: input.codeHash,
          expiresAt: input.expiresAt,
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  async findByEmail(
    email: string,
  ): Promise<PendingRegistrationDocument | null> {
    return this.pendingRegistrationModel
      .findOne({ email: email.toLowerCase() })
      .exec();
  }

  async findByEmailWithSecrets(
    email: string,
  ): Promise<PendingRegistrationDocument | null> {
    return this.pendingRegistrationModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash +codeHash')
      .exec();
  }

  async updateCode(
    id: string,
    codeHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.pendingRegistrationModel
      .updateOne({ _id: id }, { codeHash, expiresAt })
      .exec();
  }

  async deleteByEmail(email: string): Promise<void> {
    await this.pendingRegistrationModel
      .deleteOne({ email: email.toLowerCase() })
      .exec();
  }
}
