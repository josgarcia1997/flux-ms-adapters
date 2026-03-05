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
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface RequestWithAuth extends Request {
  user?: { userId: string; tenantId: string; sessionId: string };
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
      request.user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        sessionId: payload.sessionId,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
