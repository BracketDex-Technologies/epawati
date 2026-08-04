import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  mandalId: string | null;
  role: UserRole;
  sessionId: string;
}

export const JwtPayload = Symbol('JwtPayload');

export interface RefreshJwtPayload {
  sub: string;
  sessionId: string;
  type: 'refresh';
}

export const RefreshJwtPayload = Symbol('RefreshJwtPayload');
