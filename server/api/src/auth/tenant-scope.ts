import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthContext } from './auth-context';

interface FestivalLookup {
  festival: {
    findFirst(args: {
      select: { id: true };
      where: { id: string; mandalId: string };
    }): Promise<{ id: string } | null>;
  };
}

export function assertSameMandal(ctx: AuthContext, mandalId: string): void {
  if (ctx.role === UserRole.SUPER_ADMIN) {
    return;
  }

  if (!ctx.mandalId || ctx.mandalId !== mandalId) {
    throw new ForbiddenException('You do not have access to this mandal.');
  }
}

export function requireMandalId(ctx: AuthContext): string {
  if (!ctx.mandalId) {
    throw new ForbiddenException('This action requires a mandal-scoped user.');
  }

  return ctx.mandalId;
}

export async function assertFestivalInMandal(
  prisma: FestivalLookup,
  mandalId: string,
  festivalId: string,
): Promise<void> {
  const festival = await prisma.festival.findFirst({
    select: { id: true },
    where: { id: festivalId, mandalId },
  });

  // Do not confirm whether an identifier belongs to another tenant.
  if (!festival) {
    throw new ForbiddenException('Festival is not available in this mandal.');
  }
}
