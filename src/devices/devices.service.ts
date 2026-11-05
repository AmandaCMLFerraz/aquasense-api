import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/create-device.dto';
import { Device, DeviceDocument } from './schemas/device.schema';
import { ConsumerUnitsService } from '../consumer-units/consumer-units.service';
import { ConsumptionRecordsService } from '../consumption-records/consumption-records.service';
import { SensorReadingsService } from '../sensor-readings/sensor-readings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { currentFlowRate as currentFlowRateOf } from '../common/utils/approximate-flow-rate';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FLOW_HISTORY_WINDOW_MS = 60 * 60 * 1000;
const COMMUNICATION_TIMEOUT_MS = 30 * 1000;

export interface DeviceListItem {
  id: string;
  consumerUnitId: string;
  name: string;
  description: string | null;
  identifier: string;
  status: 'online' | 'offline';
  currentFlowRate: number | null;
  todayConsumption: number;
  lastSeenAt: Date | null;
}

export interface DeviceFlowSample {
  timestamp: Date;
  flowRate: number;
}

export interface DeviceDetail extends DeviceListItem {
  consumerUnitName: string;
  calibrationFactor: number;
  installedAt: Date;
  weekConsumption: number;
  flowHistory: DeviceFlowSample[];
}

@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @Inject(forwardRef(() => ConsumerUnitsService))
    private readonly consumerUnitsService: ConsumerUnitsService,
    private readonly consumptionRecordsService: ConsumptionRecordsService,
    private readonly sensorReadingsService: SensorReadingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    createDeviceDto: CreateDeviceDto,
  ): Promise<DeviceListItem> {
    const identifier = createDeviceDto.identifier.toUpperCase();
    const existing = await this.deviceModel.findOne({ identifier }).exec();

    if (existing) {
      throw new ConflictException(
        'Este dispositivo já está vinculado a uma conta.',
      );
    }

    const consumerUnit = createDeviceDto.consumerUnitId
      ? await this.consumerUnitsService.findOneForUser(
          userId,
          createDeviceDto.consumerUnitId,
        )
      : await this.consumerUnitsService.getOrCreateDefault(userId);

    const device = await this.deviceModel.create({
      consumerUnitId: consumerUnit._id,
      identifier,
      name: createDeviceDto.name,
      description: createDeviceDto.description,
      calibrationFactor: createDeviceDto.calibrationFactor,
    });

    return this.toListItem(device);
  }

  async findAllForUser(userId: string): Promise<DeviceListItem[]> {
    const consumerUnitIds =
      await this.consumerUnitsService.findIdsForUser(userId);
    const devices = await this.deviceModel
      .find({ consumerUnitId: { $in: consumerUnitIds } })
      .exec();

    return Promise.all(devices.map((device) => this.toListItem(device)));
  }

  async findOneForUser(
    userId: string,
    deviceId: string,
  ): Promise<DeviceDetail> {
    const consumerUnitIds =
      await this.consumerUnitsService.findIdsForUser(userId);
    const device = await this.deviceModel
      .findOne({ _id: deviceId, consumerUnitId: { $in: consumerUnitIds } })
      .exec();

    if (!device) {
      throw new NotFoundException('Dispositivo não encontrado.');
    }

    const now = Date.now();
    const [listItem, consumerUnit, weekConsumption, flowHistory] =
      await Promise.all([
        this.toListItem(device),
        this.consumerUnitsService.getById(device.consumerUnitId),
        this.consumptionRecordsService.getConsumptionForDeviceSince(
          device._id,
          new Date(now - WEEK_MS),
        ),
        this.consumptionRecordsService.getRecentFlowHistoryForDevice(
          device._id,
          new Date(now - FLOW_HISTORY_WINDOW_MS),
        ),
      ]);

    return {
      ...listItem,
      consumerUnitName: consumerUnit?.name ?? '—',
      calibrationFactor: device.calibrationFactor,
      installedAt: device.createdAt ?? device._id.getTimestamp(),
      weekConsumption: Number(weekConsumption.toFixed(2)),
      flowHistory,
    };
  }

  async update(
    userId: string,
    deviceId: string,
    updateDeviceDto: UpdateDeviceDto,
  ): Promise<DeviceListItem> {
    const consumerUnitIds =
      await this.consumerUnitsService.findIdsForUser(userId);
    const device = await this.deviceModel
      .findOne({ _id: deviceId, consumerUnitId: { $in: consumerUnitIds } })
      .exec();

    if (!device) {
      throw new NotFoundException('Dispositivo não encontrado.');
    }

    if (updateDeviceDto.consumerUnitId) {
      await this.consumerUnitsService.findOneForUser(
        userId,
        updateDeviceDto.consumerUnitId,
      );
    }

    Object.assign(device, updateDeviceDto);
    await device.save();

    return this.toListItem(device);
  }

  async remove(userId: string, deviceId: string): Promise<void> {
    const consumerUnitIds =
      await this.consumerUnitsService.findIdsForUser(userId);
    const device = await this.deviceModel
      .findOne({ _id: deviceId, consumerUnitId: { $in: consumerUnitIds } })
      .exec();

    if (!device) {
      throw new NotFoundException('Dispositivo não encontrado.');
    }

    await this.consumptionRecordsService.deleteAllForDevice(device._id);
    await this.sensorReadingsService.deleteAllForDevice(device._id);
    await this.deviceModel.deleteOne({ _id: device._id }).exec();
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sweepOfflineDevices(): Promise<void> {
    const onlineDevices = await this.deviceModel
      .find({ status: 'online' })
      .exec();

    for (const device of onlineDevices) {
      const lastSeenAt = await this.resolveLastSeenAt(device);
      const isStale =
        !lastSeenAt ||
        Date.now() - lastSeenAt.getTime() > COMMUNICATION_TIMEOUT_MS;

      if (isStale) {
        await this.deviceModel
          .updateOne({ _id: device._id }, { status: 'offline' })
          .exec();
        await this.notificationsService.createForDevice(
          device._id,
          'communication_failure',
          'Falha de comunicação',
          `"${device.name}" está sem sinal há mais de ${COMMUNICATION_TIMEOUT_MS / 1000} s.`,
        );
      }
    }
  }

  private async toListItem(device: DeviceDocument): Promise<DeviceListItem> {
    const [latestRecord, todayConsumption, lastSeenAt] = await Promise.all([
      this.consumptionRecordsService.getLatestForDevice(device._id),
      this.consumptionRecordsService.getTodayConsumptionForDevice(device._id),
      this.resolveLastSeenAt(device),
    ]);

    const currentFlowRate =
      device.status === 'online' ? currentFlowRateOf(latestRecord) : null;

    return {
      id: String(device._id),
      consumerUnitId: String(device.consumerUnitId),
      name: device.name,
      description: device.description ?? null,
      identifier: device.identifier,
      status: device.status,
      currentFlowRate,
      todayConsumption,
      lastSeenAt,
    };
  }

  private async resolveLastSeenAt(
    device: DeviceDocument,
  ): Promise<Date | null> {
    if (device.lastSeenAt) {
      return device.lastSeenAt;
    }

    const latestReading = await this.sensorReadingsService.getLatestForDevice(
      device._id,
    );
    return latestReading?.endConsumption ?? null;
  }
}
