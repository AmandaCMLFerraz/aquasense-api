import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AddressDto {
  @IsString()
  @MinLength(1)
  street: string;

  @IsString()
  @MinLength(1)
  number: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsString()
  @MinLength(1)
  city: string;

  @IsString()
  @MinLength(2)
  state: string;

  @IsOptional()
  @IsString()
  zipCode?: string;
}

export class CreateConsumerUnitDto {
  @IsString()
  @MinLength(2)
  name: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @IsNumber()
  @Min(0)
  numberResidents: number;

  @IsNumber()
  @Min(0)
  dailyConsumptionLimit: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyConsumptionLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  leakDurationMinutes?: number;
}

export class UpdateConsumerUnitDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  numberResidents?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyConsumptionLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyConsumptionLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  leakDurationMinutes?: number;
}
