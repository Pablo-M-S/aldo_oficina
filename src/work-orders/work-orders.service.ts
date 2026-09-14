import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { AddWorkOrderItemDto } from './dto/add-work-order-item.dto';
import { UpdateWorkOrderStatusDto } from './dto/update-work-order-status.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Role } from '../common/enums/role.enum';

// Máquina de estados da OS. Only these transitions are allowed — qualquer
// outra combinação é rejeitada, inclusive "pular" etapas do fluxo.
const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.OPEN]: [WorkOrderStatus.DIAGNOSING, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.DIAGNOSING]: [WorkOrderStatus.AWAITING_APPROVAL, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.AWAITING_APPROVAL]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.IN_PROGRESS]: [
    WorkOrderStatus.AWAITING_PARTS,
    WorkOrderStatus.COMPLETED,
    WorkOrderStatus.CANCELLED,
  ],
  [WorkOrderStatus.AWAITING_PARTS]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.COMPLETED]: [WorkOrderStatus.DELIVERED],
  [WorkOrderStatus.CANCELLED]: [],
  [WorkOrderStatus.DELIVERED]: [],
};

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  private async resolveCustomerId(
    requestedCustomerId: string | undefined,
    requester: AuthenticatedUser,
  ): Promise<string> {
    if (requester.role !== Role.CUSTOMER) {
      if (!requestedCustomerId) {
        throw new BadRequestException('Informe o customerId ao abrir a OS em nome de um cliente.');
      }
      return requestedCustomerId;
    }
    const ownCustomer = await this.prisma.customer.findUnique({ where: { userId: requester.sub } });
    if (!ownCustomer) {
      throw new NotFoundException('Cadastro de cliente não encontrado para este usuário.');
    }
    return ownCustomer.id;
  }

  async create(dto: CreateWorkOrderDto, requester: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(dto.customerId, requester);

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle || vehicle.customerId !== customerId) {
      throw new NotFoundException('Veículo não encontrado para este cliente.');
    }

    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: dto.appointmentId },
      });
      if (!appointment || appointment.customerId !== customerId) {
        throw new NotFoundException('Agendamento não encontrado para este cliente.');
      }
    }

    return this.prisma.workOrder.create({
      data: {
        customerId,
        vehicleId: dto.vehicleId,
        appointmentId: dto.appointmentId,
        mechanicId: dto.mechanicId,
        diagnosis: dto.diagnosis,
        notes: dto.notes,
      },
    });
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { items: true, customer: true },
    });
    if (!workOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada.');
    }

    if (requester.role === Role.CUSTOMER && workOrder.customer.userId !== requester.sub) {
      throw new ForbiddenException('Você não tem acesso a esta ordem de serviço.');
    }

    return workOrder;
  }

  findAllForCustomer(customerId: string) {
    return this.prisma.workOrder.findMany({
      where: { customerId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Visão administrativa: todas as OS em andamento (exclui finalizadas por
   * padrão para não poluir o painel do dia a dia com histórico encerrado).
   */
  findAllOpen() {
    return this.prisma.workOrder.findMany({
      where: { status: { notIn: [WorkOrderStatus.CANCELLED, WorkOrderStatus.DELIVERED] } },
      include: {
        customer: { include: { user: { select: { name: true } } } },
        vehicle: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Adiciona um item (serviço ou peça) à OS. Se for peça, a baixa de estoque
   * acontece na MESMA transação da criação do item: ou os dois acontecem, ou
   * nenhum acontece — nunca um WorkOrderItem "órfão" sem estoque baixado.
   */
  async addItem(workOrderId: string, dto: AddWorkOrderItemDto, requester: AuthenticatedUser) {
    if (requester.role === Role.CUSTOMER) {
      throw new ForbiddenException('Apenas a equipe da oficina pode lançar itens na OS.');
    }
    if (!dto.serviceId && !dto.productId) {
      throw new BadRequestException('Informe serviceId ou productId.');
    }

    const workOrder = await this.prisma.workOrder.findUnique({ where: { id: workOrderId } });
    if (!workOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada.');
    }
    if ([WorkOrderStatus.CANCELLED, WorkOrderStatus.DELIVERED].includes(workOrder.status)) {
      throw new BadRequestException('Não é possível lançar itens em uma OS finalizada.');
    }

    const quantity = dto.quantity ?? 1;

    return this.prisma.$transaction(async (tx) => {
      let unitPrice: number;

      if (dto.productId) {
        await this.inventoryService.consumeForWorkOrder(tx, dto.productId, quantity);
        const product = await tx.product.findUnique({ where: { id: dto.productId } });
        unitPrice = dto.unitPriceOverride ?? Number(product.price);
      } else {
        const service = await tx.service.findUnique({ where: { id: dto.serviceId } });
        if (!service || !service.isActive) {
          throw new NotFoundException('Serviço não encontrado ou inativo.');
        }
        unitPrice = dto.unitPriceOverride ?? Number(service.price);
      }

      const item = await tx.workOrderItem.create({
        data: {
          workOrderId,
          serviceId: dto.serviceId,
          productId: dto.productId,
          quantity,
          unitPrice,
        },
      });

      await this.recalculateTotal(tx, workOrderId);

      return item;
    });
  }

  private async recalculateTotal(tx: any, workOrderId: string) {
    const [items, workOrder] = await Promise.all([
      tx.workOrderItem.findMany({ where: { workOrderId } }),
      tx.workOrder.findUnique({ where: { id: workOrderId } }),
    ]);

    const itemsTotal = items.reduce(
      (sum: number, item: any) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );
    const totalCost = itemsTotal + Number(workOrder.laborCost);

    await tx.workOrder.update({ where: { id: workOrderId }, data: { totalCost } });
  }

  async updateStatus(id: string, dto: UpdateWorkOrderStatusDto, requester: AuthenticatedUser) {
    if (requester.role === Role.CUSTOMER) {
      throw new ForbiddenException('Apenas a equipe da oficina pode alterar o status da OS.');
    }

    const workOrder = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!workOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada.');
    }

    const allowedNextStatuses = ALLOWED_TRANSITIONS[workOrder.status as WorkOrderStatus];
    if (!allowedNextStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Transição inválida: ${workOrder.status} → ${dto.status}. ` +
          `Transições permitidas a partir de ${workOrder.status}: ${allowedNextStatuses.join(', ') || 'nenhuma'}.`,
      );
    }

    return this.prisma.workOrder.update({ where: { id }, data: { status: dto.status } });
  }
}
