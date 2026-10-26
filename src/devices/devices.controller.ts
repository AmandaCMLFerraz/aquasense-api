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
import { DevicesService } from './devices.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/create-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  async create(
    @CurrentUser() currentUser: JwtPayload,
    @Body() createDeviceDto: CreateDeviceDto,
  ) {
    return this.devicesService.create(currentUser.sub, createDeviceDto);
  }

  @Get()
  async findAll(@CurrentUser() currentUser: JwtPayload) {
    return this.devicesService.findAllForUser(currentUser.sub);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.devicesService.findOneForUser(currentUser.sub, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
    @Body() updateDeviceDto: UpdateDeviceDto,
  ) {
    return this.devicesService.update(currentUser.sub, id, updateDeviceDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.devicesService.remove(currentUser.sub, id);
  }
}
