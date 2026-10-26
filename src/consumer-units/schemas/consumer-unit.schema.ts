import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ _id: false })
export class Address {
  @Prop({ required: true, trim: true })
  declare street: string;

  @Prop({ required: true, trim: true })
  declare number: string;

  @Prop({ trim: true })
  neighborhood?: string;

  @Prop({ required: true, trim: true })
  declare city: string;

  @Prop({ required: true, trim: true })
  declare state: string;

  @Prop({ trim: true })
  zipCode?: string;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

export type ConsumerUnitDocument = HydratedDocument<ConsumerUnit>;

@Schema({ timestamps: true })
export class ConsumerUnit {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  declare userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  declare name: string;

  @Prop({ type: AddressSchema, required: true })
  declare address: Address;

  @Prop({ required: true, min: 0 })
  declare numberResidents: number;

  @Prop({ required: true, min: 0 })
  declare dailyConsumptionLimit: number;

  @Prop({ required: true, min: 0, default: 100 })
  declare hourlyConsumptionLimit: number;

  @Prop({ required: true, min: 1, default: 30 })
  declare leakDurationMinutes: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ConsumerUnitSchema = SchemaFactory.createForClass(ConsumerUnit);
