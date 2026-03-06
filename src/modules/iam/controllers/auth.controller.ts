import { Body, Controller, Get, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Validate OTP and return registration token (step 2). Use token in step 3 with profile + password.' })
  async registerConfirm(@Body() dto: RegisterConfirmDto) {
    return this.authService.registerConfirm(dto);
  }

  @Post('register-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Step 3: with registration token → create user, party, kyc_case and return login tokens. With normal JWT → update existing profile.',
  })
  async registerProfile(
    @Body() dto: RegisterProfileDto,
    @Req() req: RequestWithAuth & { ip?: string; get: (s: string) => string | undefined },
  ) {
    const u = req.user;
    if (!u) throw new UnauthorizedException('Missing user context');
    if ('reg' in u && u.reg === true) {
      const ip = req.ip;
      const userAgent = req.get?.('user-agent');
      return this.authService.completeRegistration(
        { email: u.email, username: u.username, tenantId: u.tenantId },
        dto,
        ip,
        userAgent,
      );
    }
    const userId = 'userId' in u ? u.userId : undefined;
    if (userId && u.tenantId) {
      return this.authService.registerProfile(userId, u.tenantId, dto);
    }
    throw new UnauthorizedException('Invalid user context');
  }

  @Post('register-kyc')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete KYC and address (step 4)' })
  async registerKyc(@Body() dto: RegisterKycDto, @Req() req: RequestWithAuth) {
    const u = req.user;
    const userId = u && 'userId' in u ? u.userId : undefined;
    const tenantId = u?.tenantId;
    const partyId = u && 'partyId' in u ? u.partyId : undefined;
    if (!userId || !tenantId) throw new UnauthorizedException('Missing user context');
    return this.authService.registerKyc(userId, tenantId, dto, partyId);
  }

  @Get('countries')
  @ApiOperation({ summary: 'List active countries (core.countries)' })
  async getCountries() {
    return this.authService.getCountries();
  }

  @Get('identification-types')
  @ApiOperation({ summary: 'List active identification types (core.identification_types); optional countryId filter' })
  async getIdentificationTypes(@Query('countryId') countryId?: string) {
    return this.authService.getIdentificationTypes(countryId);
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
    const u = req.user;
    const sessionId = u && 'sessionId' in u ? u.sessionId : undefined;
    if (sessionId) await this.authService.logout(sessionId);
    return { ok: true };
  }
}
