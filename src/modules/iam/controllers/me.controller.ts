import { Controller, Get, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, MeResponse } from '../services/auth.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import type { RequestWithAuth } from '../../../common/guards/jwt-auth.guard';

@ApiTags('me')
@Controller()
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  async me(@Req() req: RequestWithAuth): Promise<MeResponse> {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    if (!userId || !tenantId) throw new UnauthorizedException('Missing user context');
    const me = await this.authService.getMe(userId, tenantId);
    if (!me) throw new UnauthorizedException('User not found');
    return me;
  }

  @Get('me/kyc-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC status of current user\'s party' })
  async getKycStatus(@Req() req: RequestWithAuth): Promise<{ kyc_status: string | null }> {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    if (!userId || !tenantId) throw new UnauthorizedException('Missing user context');
    return this.authService.getKycStatus(userId, tenantId);
  }
}
