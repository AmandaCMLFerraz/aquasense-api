import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SensorReadingsService } from './sensor-readings.service';
import { SensorReadingsController } from './sensor-readings.controller';
import { DeviceKeyGuard } from './guards/device-key.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { Device, DeviceSchema } from '../devices/schemas/device.schema';
import {
  SensorReading,
  SensorReadingSchema,
} from './schemas/sensor-reading.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Device.name, schema: DeviceSchema },
      { name: SensorReading.name, schema: SensorReadingSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [SensorReadingsController],
  providers: [SensorReadingsService, DeviceKeyGuard],
  exports: [SensorReadingsService],
})
export class SensorReadingsModule {}
