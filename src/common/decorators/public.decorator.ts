import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca uma rota como pública, isentando-a do JwtAuthGuard global.
 * Uso: @Public() no handler de login/registro.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
