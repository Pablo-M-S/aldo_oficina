import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const skuTaken = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (skuTaken) {
      throw new ConflictException('Já existe um produto com este SKU.');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: dto });

      // Quantidade inicial também vira um InventoryMovement (ENTRY), para que
      // o histórico do produto sempre explique 100% do saldo atual — nunca
      // existe estoque "do nada" fora de uma movimentação registrada.
      if (dto.quantity > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            type: InventoryMovementType.ENTRY,
            quantity: dto.quantity,
            reason: 'Estoque inicial de cadastro',
          },
        });
      }

      return product;
    });
  }

  findAll(onlyActive = true) {
    return this.prisma.product.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  findLowStock() {
    // Prisma não compara duas colunas da mesma tabela diretamente no `where`
    // sem um filtro raw; para o volume esperado de um catálogo de peças de
    // oficina, filtrar em memória é simples e suficientemente performático.
    return this.prisma.product
      .findMany({ where: { isActive: true } })
      .then((products) => products.filter((product) => product.quantity <= product.minimumStock));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Produto não encontrado.');
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Único caminho para alterar Product.quantity. Sempre grava um
   * InventoryMovement na mesma transação, então o saldo do produto nunca
   * diverge do somatório do seu histórico de movimentações.
   */
  async adjustStock(productId: string, dto: AdjustStockDto) {
    const product = await this.findOne(productId);

    const newQuantity = this.computeNewQuantity(product.quantity, dto);
    if (newQuantity < 0) {
      throw new BadRequestException(
        `Estoque insuficiente: disponível ${product.quantity}, solicitado ${dto.quantity}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { quantity: newQuantity },
      });

      await tx.inventoryMovement.create({
        data: {
          productId,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
        },
      });

      return updated;
    });
  }

  /**
   * Consumo de peça por uma ordem de serviço. Chamado internamente pelo
   * WorkOrdersService (não exposto como rota própria) para manter a criação
   * do WorkOrderItem e a baixa de estoque atômicas na mesma transação do chamador.
   */
  async consumeForWorkOrder(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
  ) {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      throw new NotFoundException('Produto não encontrado ou inativo.');
    }
    if (product.quantity - quantity < 0) {
      throw new BadRequestException(
        `Estoque insuficiente para ${product.name}: disponível ${product.quantity}, necessário ${quantity}.`,
      );
    }

    await tx.product.update({
      where: { id: productId },
      data: { quantity: product.quantity - quantity },
    });

    await tx.inventoryMovement.create({
      data: {
        productId,
        type: InventoryMovementType.WORK_ORDER_USAGE,
        quantity,
        reason: 'Uso em ordem de serviço',
      },
    });

    return product;
  }

  private computeNewQuantity(currentQuantity: number, dto: AdjustStockDto): number {
    switch (dto.type) {
      case InventoryMovementType.ENTRY:
        return currentQuantity + dto.quantity;
      case InventoryMovementType.EXIT:
      case InventoryMovementType.WORK_ORDER_USAGE:
        return currentQuantity - dto.quantity;
      case InventoryMovementType.ADJUSTMENT:
        // Para ADJUSTMENT, dto.quantity é o valor absoluto final, não um delta.
        return dto.quantity;
      default:
        throw new BadRequestException('Tipo de movimentação inválido.');
    }
  }
}
