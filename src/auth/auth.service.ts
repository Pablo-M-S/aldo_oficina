import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../common/enums/role.enum';
import { JwtPayload } from './types/authenticated-user.type';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Já existe uma conta com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // Todo cadastro público nasce como CUSTOMER. Elevar para ADMIN/MANAGER/
    // MECHANIC/ATTENDANT é uma ação administrativa separada, nunca self-service.
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: Role.CUSTOMER,
        customer: { create: {} },
      },
    });

    return this.buildAuthResponse(user.id, user.email, user.role as Role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    // Mensagem idêntica para e-mail inexistente e senha errada — evita
    // enumeração de contas via diferença de resposta.
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return this.buildAuthResponse(user.id, user.email, user.role as Role);
  }

  private buildAuthResponse(sub: string, email: string, role: Role) {
    const payload: JwtPayload = { sub, email, role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: sub, email, role },
    };
  }
}
