import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DeviceKeyGuard } from './guards/device-key.guard';
import { SensorReadingsService } from './sensor-readings.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';

@UseGuards(DeviceKeyGuard)
@Controller('sensor-readings')
export class SensorReadingsController {
  constructor(private readonly sensorReadingsService: SensorReadingsService) {}

  @Post()
  async create(@Body() createSensorReadingDto: CreateSensorReadingDto) {
    await this.sensorReadingsService.ingest(createSensorReadingDto);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.NO_CONTENT)
  async heartbeat(@Body() heartbeatDto: HeartbeatDto) {
    await this.sensorReadingsService.heartbeat(heartbeatDto.identifier);
  }
}
