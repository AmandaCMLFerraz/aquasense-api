import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SensorReadingDocument = HydratedDocument<SensorReading>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class SensorReading {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Device',
    required: true,
    index: true,
  })
  declare deviceId: Types.ObjectId;

  @Prop({ required: true })
  declare startConsumption: Date;

  @Prop({ required: true })
  declare endConsumption: Date;

  @Prop({ required: true, min: 0 })
  declare pulses: number;

  @Prop({ default: false, index: true })
  declare processed: boolean;

  @Prop()
  streamId?: number;

  @Prop()
  seq?: number;

  createdAt?: Date;
}

export const SensorReadingSchema = SchemaFactory.createForClass(SensorReading);

SensorReadingSchema.index(
  { deviceId: 1, streamId: 1, seq: 1 },
  { unique: true, partialFilterExpression: { streamId: { $exists: true } } },
);
