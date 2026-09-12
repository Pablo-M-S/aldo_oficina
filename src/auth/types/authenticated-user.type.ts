import { Role } from '../../common/enums/role.enum';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
