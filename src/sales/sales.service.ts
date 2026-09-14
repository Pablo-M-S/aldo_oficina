import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, WorkOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateSaleFromCartDto } from './dto/create-sale-from-cart.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class SalesService {
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
        throw new BadRequestException('Informe o customerId ao vender em nome de um cliente.');
      }
      return requestedCustomerId;
    }
    const ownCustomer = await this.prisma.customer.findUnique({ where: { userId: requester.sub } });
    if (!ownCustomer) {
      throw new NotFoundException('Cadastro de cliente não encontrado para este usuário.');
    }
    return ownCustomer.id;
  }

  /**
   * Checkout de produtos fora de uma OS (carrinho do módulo do cliente).
   * Baixa de estoque e criação da venda acontecem na mesma transação — ou
   * tudo é confirmado, ou nada é gravado, mesma lógica já aplicada em
   * WorkOrdersService.addItem.
   */
  async createFromCart(dto: CreateSaleFromCartDto, requester: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(dto.customerId, requester);
    const isStaff = requester.role !== Role.CUSTOMER;

    return this.prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const itemsData: { productId: string; quantity: number; unitPrice: number }[] = [];

      for (const item of dto.items) {
        await this.inventoryService.consumeForSale(tx, item.productId, item.quantity);
        const product = await tx.product.findUnique({ where: { id: item.productId } });

        // Override de preço só é honrado quando quem vende é staff — o
        // cliente nunca define o próprio preço no checkout.
        const unitPrice = isStaff && item.unitPriceOverride ? item.unitPriceOverride : Number(product.price);

        itemsData.push({ productId: item.productId, quantity: item.quantity, unitPrice });
        totalAmount += unitPrice * item.quantity;
      }

      const sale = await tx.sale.create({
        data: {
          customerId,
          totalAmount,
          items: { create: itemsData },
        },
        include: { items: true },
      });

      return sale;
    });
  }

  /**
   * Converte uma OS já concluída em uma venda cobrável. Não duplica baixa de
   * estoque: as peças já foram descontadas quando os itens foram lançados na
   * OS (WorkOrdersService.addItem). Aqui só se consolida o valor total
   * (mão de obra + itens) em um registro de venda/pagamento.
   */
  async createFromWorkOrder(workOrderId: string, requester: AuthenticatedUser) {
    if (requester.role === Role.CUSTOMER) {
      throw new ForbiddenException('Apenas a equipe da oficina pode fechar a venda de uma OS.');
    }

    const workOrder = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { sale: true },
    });
    if (!workOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada.');
    }
    if (workOrder.status !== WorkOrderStatus.COMPLETED && workOrder.status !== WorkOrderStatus.DELIVERED) {
      throw new BadRequestException('A OS precisa estar concluída antes de gerar a venda.');
    }
    if (workOrder.sale) {
      throw new ConflictException('Esta OS já tem uma venda vinculada.');
    }

    return this.prisma.sale.create({
      data: {
        customerId: workOrder.customerId,
        workOrderId: workOrder.id,
        totalAmount: workOrder.totalCost,
      },
    });
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true, payments: true, customer: true },
    });
    if (!sale) {
      throw new NotFoundException('Venda não encontrada.');
    }
    if (requester.role === Role.CUSTOMER && sale.customer.userId !== requester.sub) {
      throw new ForbiddenException('Você não tem acesso a esta venda.');
    }

    return { ...sale, ...this.computeBalance(sale) };
  }

  findAllForCustomer(customerId: string) {
    return this.prisma.sale.findMany({
      where: { customerId },
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Visão administrativa: vendas recentes de todos os clientes, com o saldo
   * já calculado — evita que o painel precise buscar pagamentos à parte.
   */
  async findAllRecent(limit = 50) {
    const sales = await this.prisma.sale.findMany({
      include: { items: true, payments: true, customer: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return sales.map((sale) => ({ ...sale, ...this.computeBalance(sale) }));
  }

  /**
   * Registra um pagamento contra o saldo em aberto da venda. Rejeita
   * pagamento acima do saldo restante — evita saldo negativo por erro de
   * digitação no caixa.
   */
  async registerPayment(saleId: string, dto: RegisterPaymentDto, requester: AuthenticatedUser) {
    if (requester.role === Role.CUSTOMER) {
      throw new ForbiddenException('Apenas a equipe da oficina pode registrar pagamentos.');
    }

    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { payments: true },
    });
    if (!sale) {
      throw new NotFoundException('Venda não encontrada.');
    }

    const { remainingAmount } = this.computeBalance(sale);
    if (dto.amount > remainingAmount) {
      throw new BadRequestException(
        `Valor informado (${dto.amount}) excede o saldo em aberto (${remainingAmount}).`,
      );
    }

    const status =
      dto.amount === remainingAmount ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

    return this.prisma.payment.create({
      data: {
        saleId,
        amount: dto.amount,
        method: dto.method,
        status,
        paidAt: new Date(),
      },
    });
  }

  private computeBalance(sale: { totalAmount: any; payments: { amount: any; status: PaymentStatus }[] }) {
    const paidAmount = sale.payments
      .filter((payment) => payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.PARTIALLY_PAID)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const remainingAmount = Number(sale.totalAmount) - paidAmount;

    return { paidAmount, remainingAmount, isFullyPaid: remainingAmount <= 0 };
  }
}
