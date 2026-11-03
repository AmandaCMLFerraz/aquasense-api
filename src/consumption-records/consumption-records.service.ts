import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Device, DeviceDocument } from '../devices/schemas/device.schema';
import {
  ConsumerUnit,
  ConsumerUnitDocument,
} from '../consumer-units/schemas/consumer-unit.schema';
import { SensorReadingsService } from '../sensor-readings/sensor-readings.service';
import { SensorReadingDocument } from '../sensor-readings/schemas/sensor-reading.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ConsumptionRecord,
  ConsumptionRecordDocument,
} from './schemas/consumption-record.schema';
import {
  approximateFlowRate,
  currentFlowRate as currentFlowRateOf,
} from '../common/utils/approximate-flow-rate';
import { buildHistoryRange, type HistoryPeriod } from './history-buckets.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const IDLE_GAP_MS = 5 * 1000;

function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

export interface DashboardSummary {
  todayLiters: number;
  dailyLimit: number;
  currentFlowRate: number;
  weeklyAverageLiters: number;
  weeklyChangePercent: number;
  monthSavingsLiters: number;
}

export type BucketStatus = 'normal' | 'above' | 'peak';

export interface HistoryBucket {
  label: string;
  liters: number;
  status: BucketStatus;
}

export interface HistorySummary {
  totalLiters: number;
  changePercent: number;
  dailyLimit: number;
  buckets: HistoryBucket[];
}

@Injectable()
export class ConsumptionRecordsService implements OnModuleInit {
  constructor(
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(ConsumerUnit.name)
    private consumerUnitModel: Model<ConsumerUnitDocument>,
    @InjectModel(ConsumptionRecord.name)
    private consumptionRecordModel: Model<ConsumptionRecordDocument>,
    private readonly sensorReadingsService: SensorReadingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.sensorReadingsService.onIngest(() =>
      this.processUnprocessedReadings(),
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processUnprocessedReadings(): Promise<void> {
    let reading = await this.sensorReadingsService.claimNextUnprocessed();
    while (reading) {
      await this.processReading(reading);
      reading = await this.sensorReadingsService.claimNextUnprocessed();
    }
  }

  async getTodayConsumptionForDevice(
    deviceId: Types.ObjectId,
  ): Promise<number> {
    return this.sumVolumeLiters({
      deviceId,
      endConsumption: { $gte: startOfToday() },
    });
  }

  async getLatestForDevice(
    deviceId: Types.ObjectId,
  ): Promise<ConsumptionRecordDocument | null> {
    return this.consumptionRecordModel
      .findOne({ deviceId })
      .sort({ endConsumption: -1 })
      .exec();
  }

  async getConsumptionForDeviceSince(
    deviceId: Types.ObjectId,
    since: Date,
  ): Promise<number> {
    return this.sumVolumeLiters({ deviceId, endConsumption: { $gte: since } });
  }

  async getRecentFlowHistoryForDevice(
    deviceId: Types.ObjectId,
    since: Date,
  ): Promise<{ timestamp: Date; flowRate: number }[]> {
    const records = await this.consumptionRecordModel
      .find({ deviceId, endConsumption: { $gte: since } })
      .sort({ endConsumption: 1 })
      .exec();

    return records.map((record) => ({
      timestamp: record.endConsumption,
      flowRate: approximateFlowRate(record),
    }));
  }

  async getDashboardSummary(
    userId: string,
    consumerUnitId?: string,
  ): Promise<DashboardSummary> {
    const { deviceIds, dailyLimit, devices } = await this.resolveUserDevices(
      userId,
      consumerUnitId,
    );

    const [todayLiters, thisWeekLiters, previousWeekLiters, monthLiters] =
      await Promise.all([
        this.sumVolumeLiters({
          deviceId: { $in: deviceIds },
          endConsumption: { $gte: startOfToday() },
        }),
        this.sumVolumeLiters({
          deviceId: { $in: deviceIds },
          endConsumption: { $gte: daysAgo(7) },
        }),
        this.sumVolumeLiters({
          deviceId: { $in: deviceIds },
          endConsumption: { $gte: daysAgo(14), $lt: daysAgo(7) },
        }),
        this.sumVolumeLiters({
          deviceId: { $in: deviceIds },
          endConsumption: { $gte: startOfMonth() },
        }),
      ]);

    const onlineDevices = devices.filter(
      (device) => device.status === 'online',
    );
    const flowRates = await Promise.all(
      onlineDevices.map(async (device) => {
        const latest = await this.getLatestForDevice(device._id);
        return currentFlowRateOf(latest);
      }),
    );
    const currentFlowRate = Number(
      flowRates.reduce((sum, rate) => sum + rate, 0).toFixed(2),
    );

    const weeklyAverageLiters = Number((thisWeekLiters / 7).toFixed(1));
    const weeklyChangePercent =
      previousWeekLiters > 0
        ? Number(
            (
              ((thisWeekLiters - previousWeekLiters) / previousWeekLiters) *
              100
            ).toFixed(1),
          )
        : 0;

    const daysElapsedThisMonth = new Date().getDate();
    const monthSavingsLiters = Math.max(
      0,
      Number((dailyLimit * daysElapsedThisMonth - monthLiters).toFixed(1)),
    );

    return {
      todayLiters: Number(todayLiters.toFixed(1)),
      dailyLimit,
      currentFlowRate,
      weeklyAverageLiters,
      weeklyChangePercent,
      monthSavingsLiters,
    };
  }

  async getHistorySummary(
    userId: string,
    period: HistoryPeriod,
    referenceDate?: Date,
    consumerUnitId?: string,
  ): Promise<HistorySummary> {
    const { deviceIds, dailyLimit } = await this.resolveUserDevices(
      userId,
      consumerUnitId,
    );
    const {
      buckets: bucketDefs,
      previousRangeStart,
      previousRangeEnd,
    } = buildHistoryRange(period, referenceDate);

    const bucketResults = await Promise.all(
      bucketDefs.map(async (bucket) => {
        const liters = await this.sumVolumeLiters({
          deviceId: { $in: deviceIds },
          endConsumption: { $gte: bucket.start, $lt: bucket.end },
        });
        const thresholdLiters =
          dailyLimit *
          ((bucket.end.getTime() - bucket.start.getTime()) / DAY_MS);

        return { label: bucket.label, liters, thresholdLiters };
      }),
    );

    const previousTotal = await this.sumVolumeLiters({
      deviceId: { $in: deviceIds },
      endConsumption: { $gte: previousRangeStart, $lt: previousRangeEnd },
    });

    const totalLiters = Number(
      bucketResults.reduce((sum, bucket) => sum + bucket.liters, 0).toFixed(1),
    );
    const changePercent =
      previousTotal > 0
        ? Number(
            (((totalLiters - previousTotal) / previousTotal) * 100).toFixed(1),
          )
        : 0;

    const maxLiters = Math.max(
      0,
      ...bucketResults.map((bucket) => bucket.liters),
    );
    const buckets: HistoryBucket[] = bucketResults.map((bucket) => ({
      label: bucket.label,
      liters: Number(bucket.liters.toFixed(1)),
      status:
        bucket.liters > 0 && bucket.liters === maxLiters
          ? 'peak'
          : bucket.liters > bucket.thresholdLiters
            ? 'above'
            : 'normal',
    }));

    return { totalLiters, changePercent, dailyLimit, buckets };
  }

  async deleteAllForDevice(deviceId: Types.ObjectId): Promise<void> {
    await this.notificationsService.removeByDeviceId(deviceId);
    await this.consumptionRecordModel.deleteMany({ deviceId }).exec();
  }

  private async resolveUserDevices(
    userId: string,
    consumerUnitId?: string,
  ): Promise<{
    deviceIds: Types.ObjectId[];
    dailyLimit: number;
    devices: DeviceDocument[];
  }> {
    const filter = consumerUnitId
      ? { _id: consumerUnitId, userId }
      : { userId };
    const consumerUnits = await this.consumerUnitModel.find(filter).exec();

    if (consumerUnitId && consumerUnits.length === 0) {
      throw new NotFoundException('Unidade consumidora não encontrada.');
    }

    const consumerUnitIds = consumerUnits.map((unit) => unit._id);
    const dailyLimit = consumerUnits.reduce(
      (sum, unit) => sum + unit.dailyConsumptionLimit,
      0,
    );

    const devices = await this.deviceModel
      .find({ consumerUnitId: { $in: consumerUnitIds } })
      .exec();

    return {
      deviceIds: devices.map((device) => device._id),
      dailyLimit,
      devices,
    };
  }

  private async processReading(reading: SensorReadingDocument): Promise<void> {
    const device = await this.deviceModel.findById(reading.deviceId).exec();
    if (!device) {
      return;
    }

    const volumeLiters = Number(
      (reading.pulses / device.calibrationFactor).toFixed(3),
    );

    const consumerUnit = await this.consumerUnitModel
      .findById(device.consumerUnitId)
      .exec();

    let excessiveConsumption = false;
    let newlyOverDailyLimit = false;
    const dailyLimit = consumerUnit?.dailyConsumptionLimit ?? null;
    if (dailyLimit !== null && dailyLimit > 0) {
      const dayStart = new Date(reading.endConsumption);
      dayStart.setHours(0, 0, 0, 0);
      const dayVolumeBefore = await this.getConsumerUnitVolumeInWindow(
        device.consumerUnitId,
        dayStart,
        reading.endConsumption,
      );
      const overDailyLimit = dayVolumeBefore + volumeLiters > dailyLimit;
      newlyOverDailyLimit = overDailyLimit && dayVolumeBefore <= dailyLimit;
      excessiveConsumption = overDailyLimit;
    }

    let possibleLeak = false;
    let newlyLeaking = false;
    let streakMinutes = 0;
    const leakLimitMinutes = consumerUnit?.leakDurationMinutes ?? null;
    if (leakLimitMinutes !== null && reading.pulses > 0) {
      const lastIdleRecord = await this.consumptionRecordModel
        .findOne({
          deviceId: device._id,
          volumeLiters: 0,
          endConsumption: { $lte: reading.startConsumption },
        })
        .sort({ endConsumption: -1 })
        .exec();
      const streakFirstRecord = await this.consumptionRecordModel
        .findOne({
          deviceId: device._id,
          endConsumption: {
            $gt: lastIdleRecord?.endConsumption ?? new Date(0),
            $lte: reading.startConsumption,
          },
        })
        .sort({ startConsumption: 1 })
        .exec();
      const previousRecord = await this.consumptionRecordModel
        .findOne({
          deviceId: device._id,
          endConsumption: { $lte: reading.startConsumption },
        })
        .sort({ endConsumption: -1 })
        .exec();
      const hasIdleGap =
        !previousRecord ||
        reading.startConsumption.getTime() -
          previousRecord.endConsumption.getTime() >
          IDLE_GAP_MS;
      const streakStart = hasIdleGap
        ? reading.startConsumption
        : (streakFirstRecord?.startConsumption ?? reading.startConsumption);

      streakMinutes =
        (reading.endConsumption.getTime() - streakStart.getTime()) / 60000;
      possibleLeak = streakMinutes > leakLimitMinutes;
      newlyLeaking =
        possibleLeak &&
        (reading.startConsumption.getTime() - streakStart.getTime()) / 60000 <=
          leakLimitMinutes;
    }

    const record = await this.consumptionRecordModel.create({
      deviceId: device._id,
      sensorReadingId: reading._id,
      startConsumption: reading.startConsumption,
      endConsumption: reading.endConsumption,
      volumeLiters,
      excessiveConsumption,
      possibleLeak,
    });

    if (newlyOverDailyLimit) {
      await this.notificationsService.createFromConsumptionRecord(
        record,
        'excessive_consumption',
        'Limite diário ultrapassado',
        `A unidade ultrapassou o limite diário de ${dailyLimit} L (último registro em "${device.name}").`,
      );
    }

    if (newlyLeaking) {
      await this.notificationsService.createFromConsumptionRecord(
        record,
        'possible_leak',
        'Possível vazamento',
        `Fluxo contínuo detectado em "${device.name}" há ${Math.round(streakMinutes)} min.`,
      );
    }
  }

  private async getConsumerUnitVolumeInWindow(
    consumerUnitId: Types.ObjectId,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<number> {
    const devices = await this.deviceModel
      .find({ consumerUnitId })
      .select('_id')
      .exec();

    return this.sumVolumeLiters({
      deviceId: { $in: devices.map((device) => device._id) },
      endConsumption: { $gt: windowStart, $lte: windowEnd },
    });
  }

  private async sumVolumeLiters(
    match: Record<string, unknown>,
  ): Promise<number> {
    const result = await this.consumptionRecordModel.aggregate<{
      total: number;
    }>([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$volumeLiters' } } },
    ]);

    return result[0]?.total ?? 0;
  }
}
