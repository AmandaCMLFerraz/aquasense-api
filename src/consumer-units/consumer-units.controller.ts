import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConsumerUnitsService } from './consumer-units.service';
import {
  CreateConsumerUnitDto,
  UpdateConsumerUnitDto,
} from './dto/create-consumer-unit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('consumer-units')
export class ConsumerUnitsController {
  constructor(private readonly consumerUnitsService: ConsumerUnitsService) {}

  @Post()
  async create(
    @CurrentUser() currentUser: JwtPayload,
    @Body() createConsumerUnitDto: CreateConsumerUnitDto,
  ) {
    const created = await this.consumerUnitsService.create(
      currentUser.sub,
      createConsumerUnitDto,
    );
    return this.consumerUnitsService.getSummaryForUser(
      currentUser.sub,
      String(created._id),
    );
  }

  @Get()
  async findAll(@CurrentUser() currentUser: JwtPayload) {
    return this.consumerUnitsService.findSummariesForUser(currentUser.sub);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.consumerUnitsService.getSummaryForUser(currentUser.sub, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
    @Body() updateConsumerUnitDto: UpdateConsumerUnitDto,
  ) {
    await this.consumerUnitsService.update(
      currentUser.sub,
      id,
      updateConsumerUnitDto,
    );
    return this.consumerUnitsService.getSummaryForUser(currentUser.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.consumerUnitsService.remove(currentUser.sub, id);
  }
}
