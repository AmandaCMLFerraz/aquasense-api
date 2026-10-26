import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConsumptionRecordsService } from './consumption-records.service';
import { ConsumptionRecordsController } from './consumption-records.controller';
import { Device, DeviceSchema } from '../devices/schemas/device.schema';
import {
  ConsumerUnit,
  ConsumerUnitSchema,
} from '../consumer-units/schemas/consumer-unit.schema';
import { SensorReadingsModule } from '../sensor-readings/sensor-readings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  ConsumptionRecord,
  ConsumptionRecordSchema,
} from './schemas/consumption-record.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Device.name, schema: DeviceSchema },
      { name: ConsumerUnit.name, schema: ConsumerUnitSchema },
      { name: ConsumptionRecord.name, schema: ConsumptionRecordSchema },
    ]),
    SensorReadingsModule,
    NotificationsModule,
  ],
  controllers: [ConsumptionRecordsController],
  providers: [ConsumptionRecordsService],
  exports: [ConsumptionRecordsService],
})
export class ConsumptionRecordsModule {}
