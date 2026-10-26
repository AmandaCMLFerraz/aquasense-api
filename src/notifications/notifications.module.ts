import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PushModule } from '../push/push.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import {
  ConsumerUnit,
  ConsumerUnitSchema,
} from '../consumer-units/schemas/consumer-unit.schema';
import { Device, DeviceSchema } from '../devices/schemas/device.schema';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';

@Module({
  imports: [
    PushModule,
    MongooseModule.forFeature([
      { name: ConsumerUnit.name, schema: ConsumerUnitSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
