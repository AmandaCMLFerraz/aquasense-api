import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ConsumptionRecordsService } from './consumption-records.service';
import type { HistoryPeriod } from './history-buckets.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

const VALID_PERIODS: HistoryPeriod[] = ['dia', 'semana', 'mes'];

function parseConsumerUnitId(consumerUnitId?: string): string | undefined {
  if (!consumerUnitId) {
    return undefined;
  }

  if (!Types.ObjectId.isValid(consumerUnitId)) {
    throw new BadRequestException('consumerUnitId inválido.');
  }

  return consumerUnitId;
}

function parseReferenceDate(date?: string): Date | undefined {
  const match = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

@UseGuards(JwtAuthGuard)
@Controller('consumption-records')
export class ConsumptionRecordsController {
  constructor(
    private readonly consumptionRecordsService: ConsumptionRecordsService,
  ) {}

  @Get('dashboard')
  async getDashboard(
    @CurrentUser() currentUser: JwtPayload,
    @Query('consumerUnitId') consumerUnitId?: string,
  ) {
    return this.consumptionRecordsService.getDashboardSummary(
      currentUser.sub,
      parseConsumerUnitId(consumerUnitId),
    );
  }

  @Get('history')
  async getHistory(
    @CurrentUser() currentUser: JwtPayload,
    @Query('period') period?: string,
    @Query('date') date?: string,
    @Query('consumerUnitId') consumerUnitId?: string,
  ) {
    const resolvedPeriod = VALID_PERIODS.includes(period as HistoryPeriod)
      ? (period as HistoryPeriod)
      : 'semana';

    return this.consumptionRecordsService.getHistorySummary(
      currentUser.sub,
      resolvedPeriod,
      parseReferenceDate(date),
      parseConsumerUnitId(consumerUnitId),
    );
  }
}
