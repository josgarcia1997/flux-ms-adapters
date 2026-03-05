import { createHash } from 'crypto';
import { randomInt } from 'crypto';
import { Injectable, UnauthorizedException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../repository/user.repository';
import { OAuthTokenRepository } from '../repository/oauth-token.repository';
import { LoginDto } from '../dto/login.dto';
import { RegisterRequestDto } from '../dto/register-request.dto';
import { RegisterConfirmDto } from '../dto/register-confirm.dto';
import { RegisterProfileDto } from '../dto/register-profile.dto';
import { RegisterKycDto } from '../dto/register-kyc.dto';
import * as bcrypt from 'bcryptjs';
import { TenantContextService } from '../../../common/services/tenant-context.service';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { User as UserModel } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { PasswordReset } from '../entities/password-reset.entity';
import { Party } from '../entities/party.entity';
import { PartyContact } from '../entities/party-contact.entity';
import { Address } from '../entities/address.entity';
import { Document } from '../entities/document.entity';
import { Country } from '../entities/country.entity';
import { IdentificationType } from '../entities/identification-type.entity';
import { OutboxService } from './outbox.service';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: { id: string; email: string; name: string };
  kyc_status: string | null;
  refresh_token?: string;
  expires_in?: number;
}

export interface MeResponse {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  status: string;
  roles: string[];
  permissions: string[];
  scopes: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly oauthTokenRepository: OAuthTokenRepository,
    private readonly tenantContext: TenantContextService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(UserModel)
    private readonly userModel: typeof UserModel,
    @InjectModel(Role)
    private readonly roleModel: typeof Role,
    @InjectModel(UserRole)
    private readonly userRoleModel: typeof UserRole,
    @InjectModel(PasswordReset)
    private readonly passwordResetModel: typeof PasswordReset,
    @InjectModel(Party)
    private readonly partyModel: typeof Party,
    @InjectModel(PartyContact)
    private readonly partyContactModel: typeof PartyContact,
    @InjectModel(Address)
    private readonly addressModel: typeof Address,
    @InjectModel(Document)
    private readonly documentModel: typeof Document,
    @InjectModel(Country)
    private readonly countryModel: typeof Country,
    @InjectModel(IdentificationType)
    private readonly identificationTypeModel: typeof IdentificationType,
    private readonly outboxService: OutboxService,
  ) {}

  /** Paso 1: solicitar código OTP por correo (usa tabla password_resets, igual que Laravel forgot-password). */
  async registerRequest(dto: RegisterRequestDto): Promise<{ message: string }> {
    const tenantId = this.tenantContext.getTenantId();
    const email = dto.email.toLowerCase();
    const existing = await this.userRepository.findByEmail(email, tenantId);
    if (existing) {
      throw new ConflictException('The email has already been taken.');
    }
    const otp = String(randomInt(100000, 999999));
    const token = await bcrypt.hash(otp, 10);
    const row = await this.passwordResetModel.findOne({ where: { email } });
    if (row) {
      await row.update({ token });
    } else {
      await this.passwordResetModel.create({ email, token } as any);
    }
    await this.outboxService.enqueue({
      tenantId,
      eventName: 'RegistrationOtpRequested',
      payload: {
        email,
        otp,
        tenant_id: tenantId,
        username: dto.username,
        occurred_at: new Date().toISOString(),
      },
    });
    return { message: 'Code sent to your email. Check your inbox and confirm registration.' };
  }

  /** Paso 2: validar OTP, crear la cuenta y devolver token para no pedir login. Emite UserCreated en outbox. */
  async registerConfirm(
    dto: RegisterConfirmDto,
    ip?: string,
    userAgent?: string,
  ): Promise<LoginResponse> {
    const tenantId = this.tenantContext.getTenantId();
    const email = dto.email.toLowerCase();
    const row = await this.passwordResetModel.findOne({ where: { email } });
    if (!row) {
      throw new BadRequestException('Code not found or expired. Please request a new one.');
    }
    const createdAt = row.createdAt ?? row.get('createdAt');
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (new Date(createdAt) < tenMinAgo) {
      await row.destroy();
      throw new BadRequestException('The code has expired. Please request a new one.');
    }
    const valid = await bcrypt.compare(dto.otp, row.token);
    if (!valid) {
      throw new BadRequestException('Invalid code.');
    }
    const existing = await this.userRepository.findByEmail(email, tenantId);
    if (existing) {
      await row.destroy();
      throw new ConflictException('The email has already been taken.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepository.create({
      tenantId,
      email,
      username: dto.username,
      passwordHash,
      status: 'active',
    });
    await row.destroy();

    // Crear Party, PartyContact y kyc_case en paso 2; el status de la respuesta sale del registro creado (RETURNING)
    let kyc_statusFromNewCase: string | null = null;
    const sequelize = this.partyModel.sequelize;
    if (sequelize) {
      const now = new Date();
      const displayName = dto.username?.trim() || email;
      const partyRows = await sequelize.query<{ id: string }>(
        `INSERT INTO party.parties (tenant_id, type, display_name, legal_name, document_type, document_number, status, created_at, updated_at)
         VALUES (:tenantId, 'person', :displayName, NULL, NULL, NULL, 'active', :now, :now)
         RETURNING id`,
        {
          replacements: { tenantId, displayName, now },
          type: QueryTypes.SELECT,
        },
      );
      const partyId = partyRows?.[0]?.id;
      if (partyId) {
        await sequelize.query(
          `INSERT INTO party.party_contacts (id, tenant_id, party_id, kind, value, is_primary, created_at, updated_at)
           VALUES (gen_random_uuid(), :tenantId, :partyId, 'email', :email, true, :now, :now)`,
          {
            replacements: { tenantId, partyId, email, now },
            type: QueryTypes.RAW,
          },
        );
        try {
          // INSERT raw igual que Laravel: id, tenant_id, party_id, status, level, metadata, submitted_at, reviewed_at, reviewed_by, created_at, updated_at
          const kycRows = await sequelize.query(
            `INSERT INTO party.kyc_cases (
              id, tenant_id, party_id, status, level, metadata, submitted_at, reviewed_at, reviewed_by, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), :tenantId, :partyId, 'pending', 'basic', NULL, :now, NULL, NULL, :now, :now
            ) RETURNING id, status`,
            {
              replacements: { tenantId, partyId, now },
              type: QueryTypes.SELECT,
            },
          ) as { id: string; status: string }[];
          kyc_statusFromNewCase = kycRows?.[0]?.status ?? null;
        } catch (err: any) {
          throw new BadRequestException(
            `Could not create kyc_case: ${err?.message ?? err}. Check that party.kyc_cases exists.`,
          );
        }
      }
    }

    const opsRole = await this.roleModel.findOne({ where: { tenantId, name: 'ops' } });
    if (opsRole) {
      await this.userRoleModel.create({ tenantId, userId: user.id, roleId: opsRole.id });
    }
    await this.outboxService.enqueue({
      tenantId,
      eventName: 'user.createdNexa',
      payload: {
        email: user.email,
        tenant_id: tenantId,
        user_id: user.id,
        user_status: user.status,
        occurred_at: new Date().toISOString(),
      },
      aggregateType: 'user',
      aggregateId: user.id,
    });

    const refreshToken = this.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const clientId = this.configService.get<number>('app.oauthClientId') ?? 1;
    const { accessTokenId } = await this.oauthTokenRepository.createTokenPair(
      user.id,
      this.hashRefreshToken(refreshToken),
      refreshExpiresAt,
      clientId,
    );
    const access_token = this.issueAccessToken(user.id, tenantId, accessTokenId);
    const name = user.username ?? user.email;
    const expiresIn = this.configService.get<string>('app.jwtExpiresIn') ?? '15m';
    const expiresInSeconds = expiresIn === '15m' ? 900 : 3600;
    const kyc_status = kyc_statusFromNewCase ?? (await this.getKycStatusForUser(user));
    return {
      access_token,
      token_type: 'Bearer',
      user: { id: user.id, email: user.email, name },
      kyc_status,
      refresh_token: refreshToken,
      expires_in: expiresInSeconds,
    };
  }

  /** Step 3: complete profile (names, document, PIN, T&C). Actualiza el party creado en paso 2 (no crea uno nuevo). */
  async registerProfile(userId: string, tenantId: string, dto: RegisterProfileDto): Promise<{ ok: boolean }> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.tenantId !== tenantId) {
      throw new UnauthorizedException('User not found');
    }
    const party = await this.findPartyForUser(user);
    if (!party) {
      throw new BadRequestException('Party not found. Complete registration (step 2) first.');
    }
    const country = await this.countryModel.findOne({ where: { id: dto.countryId, status: true } });
    if (!country) {
      throw new BadRequestException('Invalid country.');
    }
    const idType = await this.identificationTypeModel.findOne({
      where: { id: dto.identificationTypeId, countryId: dto.countryId, status: true },
    });
    if (!idType) {
      throw new BadRequestException('Invalid identification type for this country.');
    }
    const pinHash = await bcrypt.hash(dto.pin, 10);
    const legalName = `${dto.firstName.trim()} ${dto.lastName.trim()}`;
    const sequelize = this.partyModel.sequelize;
    if (!sequelize) throw new BadRequestException('Database connection not available');

    const updatedAt = new Date();
    const [, affectedRows] = await sequelize.query(
      `UPDATE party.parties SET
        type = :type,
        display_name = :displayName,
        legal_name = :legalName,
        date_birth = :dateBirth,
        document_type = :documentType,
        document_number = :documentNumber,
        status = :status,
        updated_at = :updatedAt
      WHERE id = :id AND deleted_at IS NULL`,
      {
        replacements: {
          id: party.id,
          type: 'person',
          displayName: legalName,
          legalName,
          dateBirth: dto.dateBirth,
          documentType: idType.docType,
          documentNumber: dto.documentNumber,
          status: 'active',
          updatedAt,
        },
        type: QueryTypes.UPDATE,
      },
    );
    if (affectedRows === 0) {
      throw new BadRequestException('Party row could not be updated. It may have been deleted.');
    }
    party.set({
      type: 'person',
      displayName: legalName,
      legalName,
      dateBirth: dto.dateBirth,
      documentType: idType.docType,
      documentNumber: dto.documentNumber,
      status: 'active',
      updatedAt,
    });

    const [doc] = await this.documentModel.findOrCreate({
      where: { partyId: party.id, tenantId, docType: idType.docType },
      defaults: {
        partyId: party.id,
        tenantId,
        docType: idType.docType,
        docNumber: dto.documentNumber,
        country: country.countryCode,
        isPrimary: true,
      } as any,
    });
    doc.docNumber = dto.documentNumber;
    doc.country = country.countryCode;
    await doc.save();

    user.pinHash = pinHash;
    user.termsAcceptedAt = dto.termsAccepted ? new Date() : null;
    await user.save();

    return { ok: true };
  }

  /**
   * Paso 4: KYC y dirección (party.addresses). Requiere JWT.
   *
   * Cómo funciona:
   * 1. Busca el usuario por userId/tenantId y el party por email (party_contacts).
   * 2. Actualiza party.parties (legal_name, date_birth) con UPDATE raw.
   * 3. Busca o crea una fila en party.addresses para ese party:
   *    - Si ya existe (mismo party_id + tenant_id), hace UPDATE raw de line1, line2, city, state, country.
   *    - Si no existe, hace INSERT raw en party.addresses con todos los campos.
   */
  async registerKyc(userId: string, tenantId: string, dto: RegisterKycDto): Promise<{ ok: boolean }> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.tenantId !== tenantId) {
      throw new UnauthorizedException('User not found');
    }
    const party = await this.findPartyForUser(user);
    if (!party) {
      throw new BadRequestException('Party not found. Complete registration first.');
    }
    const legalName = `${dto.firstName.trim()} ${dto.lastName.trim()}`;
    const sequelize = this.partyModel.sequelize;
    if (!sequelize) throw new BadRequestException('Database connection not available');

    const updatedAt = new Date();
    await sequelize.query(
      `UPDATE party.parties SET legal_name = :legalName, date_birth = :dateBirth, updated_at = :updatedAt
       WHERE id = :id AND tenant_id = :tenantId AND deleted_at IS NULL`,
      {
        replacements: { id: party.id, tenantId, legalName, dateBirth: dto.dateBirth, updatedAt },
        type: QueryTypes.UPDATE,
      },
    );
    party.set({ legalName, dateBirth: dto.dateBirth });

    const line1 = dto.addressLine ?? null;
    const line2 = [dto.neighborhood, dto.extras].filter(Boolean).join(' ') || null;
    const city = dto.municipality ?? null;
    const state = dto.department ?? null;
    const country = dto.country ?? null;

    const existing = await sequelize.query<{ id: string }>(
      `SELECT id FROM party.addresses WHERE party_id = :partyId AND tenant_id = :tenantId AND deleted_at IS NULL LIMIT 1`,
      {
        replacements: { partyId: party.id, tenantId },
        type: QueryTypes.SELECT,
      },
    );
    if (existing.length > 0) {
      await sequelize.query(
        `UPDATE party.addresses SET line1 = :line1, line2 = :line2, city = :city, state = :state, country = :country, updated_at = :updatedAt WHERE id = :id`,
        {
          replacements: { id: existing[0].id, line1, line2, city, state, country, updatedAt },
          type: QueryTypes.UPDATE,
        },
      );
    } else {
      await sequelize.query(
        `INSERT INTO party.addresses (id, tenant_id, party_id, type, line1, line2, city, state, country, is_primary, created_at, updated_at)
         VALUES (gen_random_uuid(), :tenantId, :partyId, 'kyc', :line1, :line2, :city, :state, :country, true, :now, :now)`,
        {
          replacements: {
            tenantId,
            partyId: party.id,
            line1,
            line2,
            city,
            state,
            country,
            now: updatedAt,
          },
          type: QueryTypes.RAW,
        },
      );
    }
    return { ok: true };
  }

  /** Resolve party for user via party_contacts (email + tenant). Solo devuelve party si pertenece al mismo tenant. */
  private async findPartyForUser(user: { email: string; tenantId: string }): Promise<Party | null> {
    const contact = await this.partyContactModel.findOne({
      where: { tenantId: user.tenantId, kind: 'email', value: user.email.toLowerCase() },
    });
    if (!contact) return null;
    return this.partyModel.findOne({
      where: { id: contact.partyId, tenantId: user.tenantId },
    });
  }

  /** Estado KYC del party del usuario actual (por userId/tenantId). Para uso en endpoints. */
  async getKycStatus(userId: string, tenantId: string): Promise<{ kyc_status: string | null }> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.tenantId !== tenantId) return { kyc_status: null };
    const status = await this.getKycStatusForUser(user);
    return { kyc_status: status };
  }

  /** Estado KYC del party (desde party.kyc_cases) o null si no tiene party. */
  private async getKycStatusForUser(user: { email: string; tenantId: string }): Promise<string | null> {
    const party = await this.findPartyForUser(user);
    if (!party) return null;
    const sequelize = this.partyModel.sequelize;
    if (!sequelize) return null;
    const rows = await sequelize.query<{ status: string }>(
      `SELECT status FROM party.kyc_cases WHERE party_id = :partyId AND tenant_id = :tenantId AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      {
        replacements: { partyId: party.id, tenantId: party.tenantId },
        type: QueryTypes.SELECT,
      },
    );
    return rows?.[0]?.status ?? null;
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string): Promise<LoginResponse> {
    const tenantId = this.tenantContext.getTenantId();
    const user = await this.userRepository.findByEmail(dto.email, tenantId);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'active') {
      throw new ForbiddenException('User is inactive');
    }
    const refreshToken = this.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const clientId = this.configService.get<number>('app.oauthClientId') ?? 1;
    const { accessTokenId } = await this.oauthTokenRepository.createTokenPair(
      user.id,
      this.hashRefreshToken(refreshToken),
      refreshExpiresAt,
      clientId,
    );
    const access_token = this.issueAccessToken(user.id, tenantId, accessTokenId);
    const name = user.username ?? user.email;
    const expiresIn = this.configService.get<string>('app.jwtExpiresIn') ?? '15m';
    const expiresInSeconds = expiresIn === '15m' ? 900 : 3600;
    const kyc_status = await this.getKycStatusForUser(user);
    return {
      access_token,
      token_type: 'Bearer',
      user: { id: user.id, email: user.email, name },
      kyc_status,
      refresh_token: refreshToken,
      expires_in: expiresInSeconds,
    };
  }

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const hash = this.hashRefreshToken(refreshToken);
    const found = await this.oauthTokenRepository.findByRefreshTokenHash(hash);
    if (!found) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    await this.oauthTokenRepository.revokeByAccessTokenId(found.accessTokenId);
    const tenantId = this.tenantContext.getTenantId();
    const user = await this.userRepository.findById(found.userId);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }
    const newRefreshToken = this.generateRefreshToken();
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const clientId = this.configService.get<number>('app.oauthClientId') ?? 1;
    const { accessTokenId } = await this.oauthTokenRepository.createTokenPair(
      user.id,
      this.hashRefreshToken(newRefreshToken),
      refreshExpiresAt,
      clientId,
    );
    const access_token = this.issueAccessToken(user.id, tenantId, accessTokenId);
    const name = user.username ?? user.email;
    const expiresIn = this.configService.get<string>('app.jwtExpiresIn') ?? '15m';
    const expiresInSeconds = expiresIn === '15m' ? 900 : 3600;
    const kyc_status = await this.getKycStatusForUser(user);
    return {
      access_token,
      token_type: 'Bearer',
      user: { id: user.id, email: user.email, name },
      kyc_status,
      refresh_token: newRefreshToken,
      expires_in: expiresInSeconds,
    };
  }

  async getMe(userId: string, tenantId: string): Promise<MeResponse | null> {
    const user = await this.userModel.findOne({
      where: { id: userId, tenantId },
      include: [
        {
          association: 'roles',
          attributes: ['name'],
          through: { attributes: [] },
          include: [
            { association: 'permissions', attributes: ['key'], through: { attributes: [] } },
          ],
        },
      ],
    });
    if (!user) return null;
    const roles = (user.roles ?? []).map((r: Role) => r.name).sort();
    const permissions = (user.roles ?? [])
      .flatMap((r: Role) => (r.permissions ?? []).map((p: Permission) => p.key))
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
      .sort();
    const scopes = [...roles];
    if (roles.includes('admin') || roles.includes('ops')) {
      if (!scopes.includes('admin')) scopes.push('admin');
    }
    return {
      id: userId,
      tenant_id: tenantId,
      name: user.username ?? user.email,
      email: user.email,
      status: user.status,
      roles,
      permissions,
      scopes,
    };
  }

  async logout(accessTokenId: string): Promise<void> {
    await this.oauthTokenRepository.revokeByAccessTokenId(accessTokenId);
  }

  private issueAccessToken(userId: string, tenantId: string, accessTokenId: string): string {
    const secret = this.configService.get<string>('app.jwtSecret');
    const expiresIn = this.configService.get<string>('app.jwtExpiresIn') ?? '15m';
    return this.jwtService.sign(
      { sub: userId, tenantId, sessionId: accessTokenId },
      { secret, expiresIn },
    );
  }

  private generateRefreshToken(): string {
    return require('crypto').randomBytes(64).toString('hex');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
