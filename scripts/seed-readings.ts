import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { SensorReadingsService } from '../src/sensor-readings/sensor-readings.service';
import { ConsumptionRecordsService } from '../src/consumption-records/consumption-records.service';
import { Device, DeviceDocument } from '../src/devices/schemas/device.schema';

const READING_INTERVAL_MINUTES = 15;
const DAY_START_HOUR = 6;
const FLOW_PROBABILITY = 0.3;
const MIN_FLOW_RATE = 1;
const MAX_FLOW_RATE = 9;
const DEFAULT_CALIBRATION_FACTOR = 450;

async function main() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error(
      'Uso: npm run seed:readings -- <identifier>\n' +
        'Ex.: npm run seed:readings -- AA:BB:CC:DD:EE:FF',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const sensorReadingsService = app.get(SensorReadingsService);
  const consumptionRecordsService = app.get(ConsumptionRecordsService);
  const deviceModel = app.get<Model<DeviceDocument>>(getModelToken(Device.name));

  const device = await deviceModel
    .findOne({ identifier: identifier.toUpperCase() })
    .exec();
  if (!device) {
    console.error(`Nenhum dispositivo cadastrado com identifier ${identifier}.`);
    await app.close();
    process.exit(1);
  }
  const calibrationFactor = device.calibrationFactor ?? DEFAULT_CALIBRATION_FACTOR;

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);

  let windowStart = dayStart;
  let readingsCount = 0;

  while (windowStart < now) {
    const windowEnd = new Date(
      Math.min(
        windowStart.getTime() + READING_INTERVAL_MINUTES * 60000,
        now.getTime(),
      ),
    );

    const isFlowing = Math.random() < FLOW_PROBABILITY;
    const flowRate = isFlowing
      ? Number(
          (Math.random() * (MAX_FLOW_RATE - MIN_FLOW_RATE) + MIN_FLOW_RATE).toFixed(1),
        )
      : 0;
    const durationMinutes = (windowEnd.getTime() - windowStart.getTime()) / 60000;
    const volumeLiters = (flowRate / 60) * durationMinutes;
    const pulses = Math.round(volumeLiters * calibrationFactor);

    await sensorReadingsService.ingestForTesting(
      identifier,
      pulses,
      windowStart,
      windowEnd,
    );
    readingsCount += 1;
    windowStart = windowEnd;
  }

  await consumptionRecordsService.processUnprocessedReadings();

  console.log(
    `${readingsCount} leituras fictícias inseridas e processadas para ${identifier} ` +
      `(${dayStart.toLocaleTimeString('pt-BR')} até ${now.toLocaleTimeString('pt-BR')}).`,
  );

  await app.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
