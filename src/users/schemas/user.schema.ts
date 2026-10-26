import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  declare name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  declare email: string;

  @Prop({ required: true, select: false })
  declare passwordHash: string;

  @Prop({ type: [String], default: [] })
  declare fcmTokens: string[];

  @Prop({ select: false })
  hashedRefreshToken?: string;

  @Prop({ default: false })
  declare isEmailVerified: boolean;

  @Prop({ select: false })
  passwordResetCodeHash?: string;

  @Prop({ select: false })
  passwordResetExpires?: Date;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
