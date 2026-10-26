import { IsString, Matches } from 'class-validator';
import {
  MAC_ADDRESS_MESSAGE,
  MAC_ADDRESS_PATTERN,
} from '../../common/constants/mac-address.constant';

export class HeartbeatDto {
  @IsString()
  @Matches(MAC_ADDRESS_PATTERN, { message: MAC_ADDRESS_MESSAGE })
  identifier: string;
}
