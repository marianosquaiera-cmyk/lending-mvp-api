import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * JwtGuard simplificado para MVP:
 * - Si viene header 'x-merchant-id', setea user = { merchantId, type: 'merchant' }
 * - Si viene header 'x-admin-id', setea user = { adminId, type: 'admin' }
 * No valida JWT real todavía.
 */
@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const merchantId = req.headers['x-merchant-id'] as string | undefined;
    const adminId = req.headers['x-admin-id'] as string | undefined;

    if (merchantId) {
      req.user = { type: 'merchant', merchantId };
      return true;
    }

    if (adminId) {
      req.user = { type: 'admin', adminId };
      return true;
    }

    // Permitir acceso público para endpoints que no necesitan auth
    return false;
  }
}