import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ConsumerUnit,
  ConsumerUnitDocument,
} from '../consumer-units/schemas/consumer-unit.schema';
import { Device, DeviceDocument } from '../devices/schemas/device.schema';
import { ConsumptionRecordDocument } from '../consumption-records/schemas/consumption-record.schema';
import { PushService } from '../push/push.service';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(ConsumerUnit.name)
    private consumerUnitModel: Model<ConsumerUnitDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private readonly pushService: PushService,
  ) {}

  async createFromConsumptionRecord(
    consumptionRecord: ConsumptionRecordDocument,
    type: NotificationType,
    title: string,
    message: string,
  ): Promise<void> {
    const notification = await this.notificationModel.create({
      consumptionRecordId: consumptionRecord._id,
      deviceId: consumptionRecord.deviceId,
      type,
      title,
      message,
    });
    void this.pushToOwner(notification);
  }

  async createForDevice(
    deviceId: Types.ObjectId,
    type: NotificationType,
    title: string,
    message: string,
  ): Promise<void> {
    const notification = await this.notificationModel.create({
      deviceId,
      type,
      title,
      message,
    });
    void this.pushToOwner(notification);
  }

  async findAllForUser(userId: string): Promise<NotificationDocument[]> {
    const deviceIds = await this.getDeviceIdsForUser(userId);

    return this.notificationModel
      .find({ deviceId: { $in: deviceIds } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const deviceIds = await this.getDeviceIdsForUser(userId);

    const result = await this.notificationModel
      .updateOne(
        { _id: notificationId, deviceId: { $in: deviceIds } },
        { read: true },
      )
      .exec();

    if (result.matchedCount === 0) {
      throw new NotFoundException('Notificação não encontrada.');
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    const deviceIds = await this.getDeviceIdsForUser(userId);

    await this.notificationModel
      .updateMany({ deviceId: { $in: deviceIds } }, { read: true })
      .exec();
  }

  async removeByDeviceId(deviceId: Types.ObjectId): Promise<void> {
    await this.notificationModel.deleteMany({ deviceId }).exec();
  }

  private async pushToOwner(notification: NotificationDocument): Promise<void> {
    try {
      const device = await this.deviceModel
        .findById(notification.deviceId)
        .select('consumerUnitId')
        .exec();
      const consumerUnit = device
        ? await this.consumerUnitModel
            .findById(device.consumerUnitId)
            .select('userId')
            .exec()
        : null;
      if (!consumerUnit) return;

      await this.pushService.sendToUser(consumerUnit.userId, {
        title: notification.title,
        body: notification.message,
        data: {
          notificationId: String(notification._id),
          type: notification.type,
        },
      });
    } catch (error) {
      this.logger.error('Falha ao enviar push', error);
    }
  }

  private async getDeviceIdsForUser(userId: string): Promise<Types.ObjectId[]> {
    const consumerUnits = await this.consumerUnitModel
      .find({ userId })
      .select('_id')
      .exec();
    const consumerUnitIds = consumerUnits.map((unit) => unit._id);

    const devices = await this.deviceModel
      .find({ consumerUnitId: { $in: consumerUnitIds } })
      .select('_id')
      .exec();

    return devices.map((device) => device._id);
  }
}
