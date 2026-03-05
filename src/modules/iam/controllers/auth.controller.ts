import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, LoginResponse } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { RegisterRequestDto } from '../dto/register-request.dto';
import { RegisterConfirmDto } from '../dto/register-confirm.dto';
import { RegisterProfileDto } from '../dto/register-profile.dto';
import { RegisterKycDto } from '../dto/register-kyc.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import type { RequestWithAuth } from '../../../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register-confirm')
  @ApiOperation({ summary: 'Confirm registration with OTP; returns tokens so user stays logged in' })
  async registerConfirm(
    @Body() dto: RegisterConfirmDto,
    @Req() req: { ip?: string; get: (s: string) => string | undefined },
  ): Promise<LoginResponse> {
    const ip = req.ip;
    const userAgent = req.get('user-agent');
    return this.authService.registerConfirm(dto, ip, userAgent);
  }

  @Post('register-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete profile (step 3)' })
  async registerProfile(@Body() dto: RegisterProfileDto, @Req() req: RequestWithAuth) {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    if (!userId || !tenantId) throw new UnauthorizedException('Missing user context');
    return this.authService.registerProfile(userId, tenantId, dto);
  }

  @Post('register-kyc')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete KYC and address (step 4)' })
  async registerKyc(@Body() dto: RegisterKycDto, @Req() req: RequestWithAuth) {
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    if (!userId || !tenantId) throw new UnauthorizedException('Missing user context');
    return this.authService.registerKyc(userId, tenantId, dto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Request OTP for registration (step 1)' })
  async registerRequest(@Body() dto: RegisterRequestDto) {
    return this.authService.registerRequest(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: { ip?: string; get: (s: string) => string | undefined },
  ): Promise<LoginResponse> {
    const ip = req.ip;
    const userAgent = req.get('user-agent');
    return this.authService.login(dto, ip, userAgent);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<LoginResponse> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout' })
  async logout(@Req() req: RequestWithAuth): Promise<{ ok: boolean }> {
    const sessionId = req.user?.sessionId;
    if (sessionId) await this.authService.logout(sessionId);
    return { ok: true };
  }
}
