import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { Device, DeviceSchema } from './schemas/device.schema';
import { ConsumerUnitsModule } from '../consumer-units/consumer-units.module';
import { ConsumptionRecordsModule } from '../consumption-records/consumption-records.module';
import { SensorReadingsModule } from '../sensor-readings/sensor-readings.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Device.name, schema: DeviceSchema }]),
    forwardRef(() => ConsumerUnitsModule),
    ConsumptionRecordsModule,
    SensorReadingsModule,
    NotificationsModule,
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
