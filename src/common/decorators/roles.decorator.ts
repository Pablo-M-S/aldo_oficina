import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Marca um handler ou controller com os papéis autorizados a acessá-lo.
 * Uso: @Roles(Role.ADMIN, Role.MANAGER)
 * A verificação real acontece no RolesGuard — este decorator só anexa metadata.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
