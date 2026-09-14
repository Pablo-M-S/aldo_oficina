import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCustomerId(
    requestedCustomerId: string | undefined,
    requester: AuthenticatedUser,
  ): Promise<string> {
    if (requester.role !== Role.CUSTOMER) {
      if (!requestedCustomerId) {
        throw new ForbiddenException('Informe o customerId do cliente dono do veículo.');
      }
      return requestedCustomerId;
    }

    const ownCustomer = await this.prisma.customer.findUnique({
      where: { userId: requester.sub },
    });
    if (!ownCustomer) {
      throw new NotFoundException('Cadastro de cliente não encontrado para este usuário.');
    }
    return ownCustomer.id;
  }

  async create(dto: CreateVehicleDto, requester: AuthenticatedUser, requestedCustomerId?: string) {
    const customerId = await this.resolveCustomerId(requestedCustomerId, requester);

    const plateTaken = await this.prisma.vehicle.findUnique({ where: { plate: dto.plate } });
    if (plateTaken) {
      throw new ConflictException('Já existe um veículo cadastrado com esta placa.');
    }

    return this.prisma.vehicle.create({ data: { ...dto, customerId } });
  }

  async findAllForCustomer(customerId: string, requester: AuthenticatedUser) {
    await this.assertCanAccessCustomer(customerId, requester);
    return this.prisma.vehicle.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
  }

  /**
   * Reutilizado por toda consulta "por cliente": sem isso, um CUSTOMER
   * autenticado poderia trocar o :customerId na URL e ver dados de outro
   * cliente (IDOR/BOLA) — a checagem de papel sozinha (RolesGuard) não
   * impede isso, só a comparação de dono é que impede.
   */
  private async assertCanAccessCustomer(customerId: string, requester: AuthenticatedUser): Promise<void> {
    if (requester.role !== Role.CUSTOMER) return;
    const ownCustomer = await this.prisma.customer.findUnique({ where: { userId: requester.sub } });
    if (!ownCustomer || ownCustomer.id !== customerId) {
      throw new ForbiddenException('Você não tem acesso aos dados deste cliente.');
    }
  }

  /**
   * Busca administrativa: encontrar um veículo pela placa é o caso de uso
   * mais comum no balcão (cliente chega, informa a placa) — muito mais
   * direto do que navegar por cliente primeiro.
   */
  async search(query?: string) {
    return this.prisma.vehicle.findMany({
      where: query
        ? {
            OR: [
              { plate: { contains: query, mode: 'insensitive' } },
              { brand: { contains: query, mode: 'insensitive' } },
              { model: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { customer: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    if (requester.role === Role.CUSTOMER && vehicle.customer.userId !== requester.sub) {
      throw new ForbiddenException('Você não tem acesso a este veículo.');
    }

    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto, requester: AuthenticatedUser) {
    await this.findOne(id, requester);
    return this.prisma.vehicle.update({ where: { id }, data: dto });
  }
}
