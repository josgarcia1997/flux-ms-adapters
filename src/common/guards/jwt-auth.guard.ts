import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  sessionId?: string;
  partyId?: string;
  reg?: boolean;
  email?: string;
  username?: string;
  iat?: number;
  exp?: number;
}

export interface RequestWithAuth extends Request {
  user?:
    | { userId: string; tenantId: string; sessionId: string; partyId?: string }
    | { reg: true; email: string; username: string; tenantId: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    const token = auth.slice(7);
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      if (payload.reg === true && payload.email != null && payload.username != null && payload.tenantId) {
        request.user = { reg: true, email: payload.email, username: payload.username, tenantId: payload.tenantId };
      } else if (payload.sub && payload.tenantId && payload.sessionId) {
        request.user = {
          userId: payload.sub,
          tenantId: payload.tenantId,
          sessionId: payload.sessionId,
          partyId: payload.partyId,
        };
      } else {
        throw new UnauthorizedException('Invalid token payload');
      }
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
