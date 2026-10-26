import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type DeviceStatus = 'online' | 'offline';
export type DeviceDocument = HydratedDocument<Device>;

@Schema({ timestamps: true })
export class Device {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ConsumerUnit',
    required: true,
    index: true,
  })
  declare consumerUnitId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  declare name: string;

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  declare identifier: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, min: 1 })
  declare calibrationFactor: number;

  @Prop({ type: String, enum: ['online', 'offline'], default: 'offline' })
  declare status: DeviceStatus;

  @Prop({ type: Date })
  lastSeenAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
