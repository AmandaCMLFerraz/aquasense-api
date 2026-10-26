import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Device, DeviceDocument } from '../devices/schemas/device.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SensorReading,
  SensorReadingDocument,
} from './schemas/sensor-reading.schema';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';

const MAX_READING_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
const DUPLICATE_KEY_CODE = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === DUPLICATE_KEY_CODE
  );
}

@Injectable()
export class SensorReadingsService {
  private readonly logger = new Logger(SensorReadingsService.name);
  private readonly ingestListeners: Array<() => Promise<void>> = [];

  constructor(
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(SensorReading.name)
    private sensorReadingModel: Model<SensorReadingDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async ingest(dto: CreateSensorReadingDto): Promise<void> {
    const device = await this.findDeviceByIdentifier(dto.identifier);
    const now = new Date();
    const endConsumption = this.resolveWindowEnd(dto.epoch, now);
    const startConsumption = new Date(
      endConsumption.getTime() - dto.durationMs,
    );

    try {
      await this.createReading(
        device,
        startConsumption,
        endConsumption,
        dto.pulses,
        { streamId: dto.streamId, seq: dto.seq },
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        await this.markSeen(device, now);
        return;
      }
      throw error;
    }
    await this.markSeen(device, now);

    for (const listener of this.ingestListeners) {
      void listener().catch((error: unknown) =>
        this.logger.error('Falha ao processar leitura recém-ingerida', error),
      );
    }
  }

  async heartbeat(identifier: string): Promise<void> {
    const device = await this.findDeviceByIdentifier(identifier);
    await this.markSeen(device, new Date());
  }

  onIngest(listener: () => Promise<void>): void {
    this.ingestListeners.push(listener);
  }

  async ingestForTesting(
    identifier: string,
    pulses: number,
    startConsumption: Date,
    endConsumption: Date,
  ): Promise<void> {
    const device = await this.findDeviceByIdentifier(identifier);
    await this.createReading(device, startConsumption, endConsumption, pulses);
    await this.markSeen(device, endConsumption);
  }

  private resolveWindowEnd(epoch: number | undefined, now: Date): Date {
    if (!epoch) return now;

    const reported = new Date(epoch * 1000);
    const tooOld = reported.getTime() < now.getTime() - MAX_READING_AGE_MS;
    const inTheFuture = reported.getTime() > now.getTime() + CLOCK_SKEW_MS;
    return tooOld || inTheFuture ? now : reported;
  }

  private async findDeviceByIdentifier(
    identifier: string,
  ): Promise<DeviceDocument> {
    const device = await this.deviceModel
      .findOne({ identifier: identifier.toUpperCase() })
      .exec();

    if (!device) {
      throw new NotFoundException('Dispositivo não encontrado.');
    }

    return device;
  }

  private async createReading(
    device: DeviceDocument,
    startConsumption: Date,
    endConsumption: Date,
    pulses: number,
    origin?: { streamId: number; seq: number },
  ): Promise<void> {
    await this.sensorReadingModel.create({
      deviceId: device._id,
      startConsumption,
      endConsumption,
      pulses,
      processed: false,
      ...origin,
    });
  }

  private async markSeen(device: DeviceDocument, at: Date): Promise<void> {
    const previous = await this.deviceModel
      .findOneAndUpdate(
        { _id: device._id },
        { status: 'online', lastSeenAt: at },
        { returnDocument: 'before' },
      )
      .exec();

    if (previous?.status === 'offline' && previous.lastSeenAt) {
      await this.notificationsService.createForDevice(
        device._id,
        'device_recovered',
        'Sensor reconectado',
        `"${device.name}" voltou a se comunicar.`,
      );
    }
  }

  async getLatestForDevice(
    deviceId: Types.ObjectId,
  ): Promise<SensorReadingDocument | null> {
    return this.sensorReadingModel
      .findOne({ deviceId })
      .sort({ endConsumption: -1 })
      .exec();
  }

  async claimNextUnprocessed(): Promise<SensorReadingDocument | null> {
    return this.sensorReadingModel
      .findOneAndUpdate(
        { processed: false },
        { processed: true },
        { returnDocument: 'after', sort: { endConsumption: 1 } },
      )
      .exec();
  }

  async deleteAllForDevice(deviceId: Types.ObjectId): Promise<void> {
    await this.sensorReadingModel.deleteMany({ deviceId }).exec();
  }
}
