import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type NotificationType =
  | 'excessive_consumption'
  | 'possible_leak'
  | 'communication_failure'
  | 'device_recovered';
export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Notification {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ConsumptionRecord',
    index: true,
  })
  consumptionRecordId?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Device',
    required: true,
    index: true,
  })
  declare deviceId: Types.ObjectId;

  @Prop({ type: String, required: true })
  declare type: NotificationType;

  @Prop({ required: true, trim: true })
  declare title: string;

  @Prop({ required: true, trim: true })
  declare message: string;

  @Prop({ default: false })
  declare read: boolean;

  createdAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
