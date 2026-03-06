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

  /** Paso 2: validar OTP y devolver registration token. No crea usuario ni party; todo se crea en paso 3. */
  async registerConfirm(dto: RegisterConfirmDto): Promise<{ registrationToken: string; expiresIn: number }> {
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
    await row.destroy();
    const registrationToken = this.issueRegistrationToken(email, dto.username, tenantId);
    return { registrationToken, expiresIn: 900 };
  }

  /**
   * Paso 3 con registration token: crea usuario, party, party_contact, kyc_case, document y devuelve tokens de login.
   * Requiere dto.password. Usar el token devuelto por registerConfirm en Authorization: Bearer <registrationToken>.
   */
  async completeRegistration(
    regUser: { email: string; username: string; tenantId: string },
    dto: RegisterProfileDto,
    ip?: string,
    userAgent?: string,
  ): Promise<LoginResponse> {
    if (!dto.password || dto.password.length < 12) {
      throw new BadRequestException('Password is required and must be at least 12 characters.');
    }
    const tenantId = regUser.tenantId;
    const email = regUser.email.toLowerCase();
    const existing = await this.userRepository.findByEmail(email, tenantId);
    if (existing) {
      throw new ConflictException('The email has already been taken.');
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
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const pinHash = await bcrypt.hash(dto.pin, 10);
    const legalName = `${dto.firstName.trim()} ${dto.lastName.trim()}`;
    const displayName = regUser.username?.trim() || email;

    const user = await this.userRepository.create({
      tenantId,
      email,
      username: regUser.username,
      passwordHash,
      status: 'active',
      pinHash,
      termsAcceptedAt: dto.termsAccepted ? new Date() : null,
    });

    const sequelize = this.partyModel.sequelize;
    if (!sequelize) throw new BadRequestException('Database connection not available');
    const now = new Date();

    const partyRows = await sequelize.query<{ id: string }>(
      `INSERT INTO party.parties (tenant_id, type, display_name, legal_name, date_birth, document_type, document_number, status, created_at, updated_at)
       VALUES (:tenantId, 'person', :displayName, :legalName, :dateBirth, :documentType, :documentNumber, 'active', :now, :now)
       RETURNING id`,
      {
        replacements: {
          tenantId,
          displayName,
          legalName,
          dateBirth: dto.dateBirth,
          documentType: idType.docType,
          documentNumber: dto.documentNumber,
          now,
        },
        type: QueryTypes.SELECT,
      },
    );
    const partyId = partyRows?.[0]?.id;
    if (!partyId) throw new BadRequestException('Could not create party.');

    await sequelize.query(
      `INSERT INTO party.party_contacts (id, tenant_id, party_id, kind, value, is_primary, created_at, updated_at)
       VALUES (gen_random_uuid(), :tenantId, :partyId, 'email', :email, true, :now, :now)`,
      {
        replacements: { tenantId, partyId, email, now },
        type: QueryTypes.RAW,
      },
    );

    try {
      await sequelize.query(
        `INSERT INTO party.kyc_cases (
          id, tenant_id, party_id, status, level, metadata, submitted_at, reviewed_at, reviewed_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), :tenantId, :partyId, 'pending', 'basic', NULL, :now, NULL, NULL, :now, :now
        )`,
        {
          replacements: { tenantId, partyId, now },
          type: QueryTypes.RAW,
        },
      );
    } catch (err: any) {
      throw new BadRequestException(
        `Could not create kyc_case: ${err?.message ?? err}. Check that party.kyc_cases exists.`,
      );
    }

    const [doc] = await this.documentModel.findOrCreate({
      where: { partyId, tenantId, docType: idType.docType },
      defaults: {
        partyId,
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
    const access_token = this.issueAccessToken(user.id, tenantId, accessTokenId, partyId);
    const name = user.username ?? user.email;
    const expiresIn = this.configService.get<string>('app.jwtExpiresIn') ?? '15m';
    const expiresInSeconds = expiresIn === '15m' ? 900 : 3600;
    const kyc_status = 'pending';
    return {
      access_token,
      token_type: 'Bearer',
      user: { id: user.id, email: user.email, name },
      kyc_status,
      refresh_token: refreshToken,
      expires_in: expiresInSeconds,
    };
  }

  private issueRegistrationToken(email: string, username: string, tenantId: string): string {
    const secret = this.configService.get<string>('app.jwtSecret');
    return this.jwtService.sign(
      { reg: true, email, username, tenantId, sub: email },
      { secret, expiresIn: '15m' },
    );
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
   * El party se identifica por partyId en el token; si no viene, se resuelve el más reciente del usuario por email.
   */
  async registerKyc(userId: string, tenantId: string, dto: RegisterKycDto, partyIdFromToken?: string): Promise<{ ok: boolean }> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.tenantId !== tenantId) {
      throw new UnauthorizedException('User not found');
    }
    const partyIdToUse = partyIdFromToken ?? (await this.findOnePartyIdForUser(user));
    const party = partyIdToUse ? await this.findPartyById(partyIdToUse, tenantId) : null;
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

    if (dto.dateIssue != null && dto.dateIssue !== '') {
      await sequelize.query(
        `UPDATE party.documents SET issued_at = :dateIssue, updated_at = :updatedAt WHERE party_id = :partyId AND tenant_id = :tenantId`,
        {
          replacements: { partyId: party.id, tenantId, dateIssue: dto.dateIssue, updatedAt },
          type: QueryTypes.UPDATE,
        },
      );
    }
    if (dto.kycResult != null && dto.kycResult !== '') {
      await sequelize.query(
        `UPDATE party.kyc_cases SET status = :status, updated_at = :updatedAt WHERE party_id = :partyId AND tenant_id = :tenantId AND deleted_at IS NULL`,
        {
          replacements: { partyId: party.id, tenantId, status: dto.kycResult.trim(), updatedAt },
          type: QueryTypes.UPDATE,
        },
      );
    }
    return { ok: true };
  }

  /** Países activos (core.countries). */
  async getCountries(): Promise<{ id: string; country_code: string; country: string; currency_code: string | null; status: boolean }[]> {
    const rows = await this.countryModel.findAll({
      where: { status: true },
      attributes: ['id', 'countryCode', 'country', 'currencyCode', 'status'],
      order: [['country', 'ASC']],
    });
    return rows.map((r) => ({
      id: r.id,
      country_code: r.countryCode,
      country: r.country,
      currency_code: r.currencyCode ?? null,
      status: r.status,
    }));
  }

  /** Catálogo: tipos de identificación activos (core.identification_types). Opcionalmente por countryId. */
  async getIdentificationTypes(countryId?: string): Promise<{ id: string; country_id: string; doc_type: string; description: string; status: boolean }[]> {
    const where: any = { status: true };
    if (countryId) where.countryId = countryId;
    const rows = await this.identificationTypeModel.findAll({
      where,
      attributes: ['id', 'countryId', 'docType', 'description', 'status'],
      order: [['description', 'ASC']],
    });
    return rows.map((r) => ({
      id: r.id,
      country_id: r.countryId,
      doc_type: r.docType,
      description: r.description,
      status: r.status,
    }));
  }

  /** Carga party por id y tenant (para uso cuando el JWT trae partyId). */
  private async findPartyById(partyId: string, tenantId: string): Promise<Party | null> {
    const sequelize = this.partyModel.sequelize;
    if (!sequelize) return null;
    const parties = await sequelize.query<{ id: string; tenant_id: string; type: string; display_name: string; legal_name: string | null; document_type: string | null; document_number: string | null; date_birth: string | null; status: string }>(
      `SELECT id, tenant_id, type, display_name, legal_name, document_type, document_number, date_birth, status FROM party.parties WHERE id = :partyId AND tenant_id = :tenantId AND deleted_at IS NULL LIMIT 1`,
      {
        replacements: { partyId, tenantId },
        type: QueryTypes.SELECT,
      },
    );
    const row = parties?.[0];
    if (!row) return null;
    return this.partyModel.build({
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type,
      displayName: row.display_name,
      legalName: row.legal_name,
      documentType: row.document_type,
      documentNumber: row.document_number,
      dateBirth: row.date_birth,
      status: row.status,
    });
  }

  /** Devuelve un party_id para el usuario cuando hay varios (el más reciente por created_at). Para poner en JWT en login/refresh. */
  private async findOnePartyIdForUser(user: { email: string; tenantId: string }): Promise<string | null> {
    const sequelize = this.partyModel.sequelize;
    if (!sequelize) return null;
    const email = user.email.toLowerCase();
    const rows = await sequelize.query<{ party_id: string }>(
      `SELECT pc.party_id FROM party.party_contacts pc
       INNER JOIN party.parties p ON p.id = pc.party_id AND p.tenant_id = pc.tenant_id AND p.deleted_at IS NULL
       WHERE pc.tenant_id = :tenantId AND pc.kind = 'email' AND pc.value = :email
       ORDER BY p.created_at DESC LIMIT 1`,
      { replacements: { tenantId: user.tenantId, email }, type: QueryTypes.SELECT },
    );
    return rows?.[0]?.party_id ?? null;
  }

  /** Resolve party for user via party_contacts (email + tenant). Usa raw query para coincidir con los INSERT en paso 3. */
  private async findPartyForUser(user: { email: string; tenantId: string }): Promise<Party | null> {
    const sequelize = this.partyModel.sequelize;
    if (!sequelize) return null;
    const email = user.email.toLowerCase();
    const rows = await sequelize.query<{ party_id: string }>(
      `SELECT party_id FROM party.party_contacts WHERE tenant_id = :tenantId AND kind = 'email' AND value = :email LIMIT 1`,
      {
        replacements: { tenantId: user.tenantId, email },
        type: QueryTypes.SELECT,
      },
    );
    const partyId = rows?.[0]?.party_id;
    if (!partyId) return null;
    const parties = await sequelize.query<{ id: string; tenant_id: string; type: string; display_name: string; legal_name: string | null; document_type: string | null; document_number: string | null; date_birth: string | null; status: string }>(
      `SELECT id, tenant_id, type, display_name, legal_name, document_type, document_number, date_birth, status FROM party.parties WHERE id = :partyId AND tenant_id = :tenantId AND deleted_at IS NULL LIMIT 1`,
      {
        replacements: { partyId, tenantId: user.tenantId },
        type: QueryTypes.SELECT,
      },
    );
    const row = parties?.[0];
    if (!row) return null;
    const party = this.partyModel.build({
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type,
      displayName: row.display_name,
      legalName: row.legal_name,
      documentType: row.document_type,
      documentNumber: row.document_number,
      dateBirth: row.date_birth,
      status: row.status,
    });
    return party;
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
    const partyId = await this.findOnePartyIdForUser(user);
    const access_token = this.issueAccessToken(user.id, tenantId, accessTokenId, partyId ?? undefined);
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
    const partyId = await this.findOnePartyIdForUser(user);
    const access_token = this.issueAccessToken(user.id, tenantId, accessTokenId, partyId ?? undefined);
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

  private issueAccessToken(userId: string, tenantId: string, accessTokenId: string, partyId?: string): string {
    const secret = this.configService.get<string>('app.jwtSecret');
    const expiresIn = this.configService.get<string>('app.jwtExpiresIn') ?? '15m';
    const payload: Record<string, string> = { sub: userId, tenantId, sessionId: accessTokenId };
    if (partyId) payload.partyId = partyId;
    return this.jwtService.sign(payload, { secret, expiresIn });
  }

  private generateRefreshToken(): string {
    return require('crypto').randomBytes(64).toString('hex');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
