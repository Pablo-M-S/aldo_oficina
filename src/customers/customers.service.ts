import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.customer.findMany({
      include: { user: { select: { id: true, name: true, email: true, isActive: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
        vehicles: true,
      },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto, requester: AuthenticatedUser) {
    const customer = await this.findOne(id);

    // Cliente só edita o próprio cadastro; staff interno pode editar qualquer um.
    const isOwner = customer.userId === requester.sub;
    const isStaff = requester.role !== Role.CUSTOMER;
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('Você não pode editar este cadastro.');
    }

    return this.prisma.customer.update({ where: { id }, data: dto });
  }
}
