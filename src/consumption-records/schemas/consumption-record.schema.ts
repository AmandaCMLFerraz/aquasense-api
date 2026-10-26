import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ConsumptionRecordDocument = HydratedDocument<ConsumptionRecord>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ConsumptionRecord {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Device',
    required: true,
    index: true,
  })
  declare deviceId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'SensorReading',
    required: true,
    unique: true,
  })
  declare sensorReadingId: Types.ObjectId;

  @Prop({ required: true })
  declare startConsumption: Date;

  @Prop({ required: true })
  declare endConsumption: Date;

  @Prop({ required: true, min: 0 })
  declare volumeLiters: number;

  @Prop({ default: false })
  declare excessiveConsumption: boolean;

  @Prop({ default: false })
  declare possibleLeak: boolean;

  createdAt?: Date;
}

export const ConsumptionRecordSchema =
  SchemaFactory.createForClass(ConsumptionRecord);
