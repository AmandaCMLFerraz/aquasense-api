import { IsString, MaxLength, MinLength } from 'class-validator';

export class FcmTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  token: string;
}
