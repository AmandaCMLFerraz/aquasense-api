import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  MAC_ADDRESS_MESSAGE,
  MAC_ADDRESS_PATTERN,
} from '../../common/constants/mac-address.constant';

const UINT32_MAX = 4294967295;
const MAX_WINDOW_MS = 10 * 60 * 1000;

export class CreateSensorReadingDto {
  @IsString()
  @Matches(MAC_ADDRESS_PATTERN, { message: MAC_ADDRESS_MESSAGE })
  identifier: string;

  @IsInt()
  @Min(0)
  pulses: number;

  @IsInt()
  @Min(0)
  @Max(UINT32_MAX)
  streamId: number;

  @IsInt()
  @Min(0)
  @Max(UINT32_MAX)
  seq: number;

  @IsInt()
  @Min(1)
  @Max(MAX_WINDOW_MS)
  durationMs: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  epoch?: number;
}
