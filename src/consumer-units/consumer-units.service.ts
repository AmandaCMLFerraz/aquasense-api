import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateConsumerUnitDto,
  UpdateConsumerUnitDto,
} from './dto/create-consumer-unit.dto';
import {
  Address,
  ConsumerUnit,
  ConsumerUnitDocument,
} from './schemas/consumer-unit.schema';
import { Device, DeviceDocument } from '../devices/schemas/device.schema';
import { DevicesService } from '../devices/devices.service';

const DEFAULT_DAILY_CONSUMPTION_LIMIT = 500;

export interface ConsumerUnitSummary {
  id: string;
  name: string;
  address: Address;
  numberResidents: number;
  dailyConsumptionLimit: number;
  hourlyConsumptionLimit: number;
  leakDurationMinutes: number;
  deviceCount: number;
}

@Injectable()
export class ConsumerUnitsService {
  constructor(
    @InjectModel(ConsumerUnit.name)
    private consumerUnitModel: Model<ConsumerUnitDocument>,
    @InjectModel(Device.name)
    private deviceModel: Model<DeviceDocument>,
    @Inject(forwardRef(() => DevicesService))
    private readonly devicesService: DevicesService,
  ) {}

  async create(
    userId: string,
    createConsumerUnitDto: CreateConsumerUnitDto,
  ): Promise<ConsumerUnitDocument> {
    return this.consumerUnitModel.create({
      userId,
      ...createConsumerUnitDto,
    });
  }

  async findAllForUser(userId: string): Promise<ConsumerUnitDocument[]> {
    return this.consumerUnitModel.find({ userId }).exec();
  }

  async findSummariesForUser(userId: string): Promise<ConsumerUnitSummary[]> {
    const consumerUnits = await this.findAllForUser(userId);

    return Promise.all(
      consumerUnits.map(async (unit) => {
        const deviceCount = await this.deviceModel
          .countDocuments({ consumerUnitId: unit._id })
          .exec();

        return {
          id: String(unit._id),
          name: unit.name,
          address: unit.address,
          numberResidents: unit.numberResidents,
          dailyConsumptionLimit: unit.dailyConsumptionLimit,
          hourlyConsumptionLimit: unit.hourlyConsumptionLimit,
          leakDurationMinutes: unit.leakDurationMinutes,
          deviceCount,
        };
      }),
    );
  }

  async findIdsForUser(userId: string): Promise<Types.ObjectId[]> {
    const consumerUnits = await this.consumerUnitModel
      .find({ userId })
      .select('_id')
      .exec();
    return consumerUnits.map((unit) => unit._id);
  }

  async getById(
    consumerUnitId: Types.ObjectId,
  ): Promise<ConsumerUnitDocument | null> {
    return this.consumerUnitModel.findById(consumerUnitId).exec();
  }

  async findOneForUser(
    userId: string,
    consumerUnitId: string,
  ): Promise<ConsumerUnitDocument> {
    const consumerUnit = await this.consumerUnitModel
      .findOne({ _id: consumerUnitId, userId })
      .exec();

    if (!consumerUnit) {
      throw new NotFoundException('Unidade consumidora não encontrada.');
    }

    return consumerUnit;
  }

  async getSummaryForUser(
    userId: string,
    consumerUnitId: string,
  ): Promise<ConsumerUnitSummary> {
    const unit = await this.findOneForUser(userId, consumerUnitId);
    const deviceCount = await this.deviceModel
      .countDocuments({ consumerUnitId: unit._id })
      .exec();

    return {
      id: String(unit._id),
      name: unit.name,
      address: unit.address,
      numberResidents: unit.numberResidents,
      dailyConsumptionLimit: unit.dailyConsumptionLimit,
      hourlyConsumptionLimit: unit.hourlyConsumptionLimit,
      leakDurationMinutes: unit.leakDurationMinutes,
      deviceCount,
    };
  }

  async update(
    userId: string,
    consumerUnitId: string,
    updateConsumerUnitDto: UpdateConsumerUnitDto,
  ): Promise<ConsumerUnitDocument> {
    const consumerUnit = await this.findOneForUser(userId, consumerUnitId);

    Object.assign(consumerUnit, updateConsumerUnitDto);
    await consumerUnit.save();

    return consumerUnit;
  }

  async remove(userId: string, consumerUnitId: string): Promise<void> {
    const consumerUnit = await this.findOneForUser(userId, consumerUnitId);

    const devices = await this.deviceModel
      .find({ consumerUnitId: consumerUnit._id })
      .select('_id')
      .exec();

    for (const device of devices) {
      await this.devicesService.remove(userId, String(device._id));
    }

    await this.consumerUnitModel.deleteOne({ _id: consumerUnit._id }).exec();
  }

  async getOrCreateDefault(userId: string): Promise<ConsumerUnitDocument> {
    const existing = await this.consumerUnitModel
      .findOne({ userId })
      .sort({ createdAt: 1 })
      .exec();

    if (existing) {
      return existing;
    }

    return this.consumerUnitModel.create({
      userId,
      name: 'Minha residência',
      address: {
        street: 'Não informado',
        number: 'S/N',
        city: 'Não informado',
        state: 'NA',
      },
      numberResidents: 1,
      dailyConsumptionLimit: DEFAULT_DAILY_CONSUMPTION_LIMIT,
    });
  }
}
