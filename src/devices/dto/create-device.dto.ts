import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import {
  MAC_ADDRESS_MESSAGE,
  MAC_ADDRESS_PATTERN,
} from '../../common/constants/mac-address.constant';

const DEFAULT_CALIBRATION_FACTOR = 450;

export class CreateDeviceDto {
  @IsString()
  @Matches(MAC_ADDRESS_PATTERN, { message: MAC_ADDRESS_MESSAGE })
  identifier: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  calibrationFactor: number = DEFAULT_CALIBRATION_FACTOR;

  @IsOptional()
  @IsMongoId()
  consumerUnitId?: string;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  calibrationFactor?: number;

  @IsOptional()
  @IsMongoId()
  consumerUnitId?: string;
}
