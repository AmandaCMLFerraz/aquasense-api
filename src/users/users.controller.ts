import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { FcmTokenDto } from './dto/fcm-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() currentUser: JwtPayload) {
    const user = await this.usersService.findById(currentUser.sub);
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Put('fcm-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerFcmToken(
    @CurrentUser() currentUser: JwtPayload,
    @Body() fcmTokenDto: FcmTokenDto,
  ) {
    await this.usersService.addFcmToken(currentUser.sub, fcmTokenDto.token);
  }

  @Delete('fcm-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeFcmToken(
    @CurrentUser() currentUser: JwtPayload,
    @Body() fcmTokenDto: FcmTokenDto,
  ) {
    await this.usersService.removeFcmToken(currentUser.sub, fcmTokenDto.token);
  }

  @Delete('profile')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() currentUser: JwtPayload) {
    await this.usersService.softDelete(currentUser.sub);
  }
}
