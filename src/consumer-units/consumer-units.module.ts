import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConsumerUnitsService } from './consumer-units.service';
import { ConsumerUnitsController } from './consumer-units.controller';
import {
  ConsumerUnit,
  ConsumerUnitSchema,
} from './schemas/consumer-unit.schema';
import { Device, DeviceSchema } from '../devices/schemas/device.schema';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConsumerUnit.name, schema: ConsumerUnitSchema },
      { name: Device.name, schema: DeviceSchema },
    ]),
    forwardRef(() => DevicesModule),
  ],
  controllers: [ConsumerUnitsController],
  providers: [ConsumerUnitsService],
  exports: [ConsumerUnitsService],
})
export class ConsumerUnitsModule {}
