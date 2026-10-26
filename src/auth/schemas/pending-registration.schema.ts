import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PendingRegistrationDocument = HydratedDocument<PendingRegistration>;

@Schema({ timestamps: true })
export class PendingRegistration {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  declare email: string;

  @Prop({ required: true, trim: true })
  declare name: string;

  @Prop({ required: true, select: false })
  declare passwordHash: string;

  @Prop({ required: true, select: false })
  declare codeHash: string;

  @Prop({ required: true, expires: 0 })
  declare expiresAt: Date;
}

export const PendingRegistrationSchema =
  SchemaFactory.createForClass(PendingRegistration);
