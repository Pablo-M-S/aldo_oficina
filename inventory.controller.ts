import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Product } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('products')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.inventoryService.create(dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.MECHANIC, Role.CUSTOMER)
  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const products = await this.inventoryService.findAll();
    // `cost` é o custo de aquisição do produto — a margem da oficina fica
    // exposta se um CUSTOMER conseguir ver esse campo. As outras roles
    // (staff) legitimamente usam `cost`, ex. no painel administrativo.
    return user.role === Role.CUSTOMER ? products.map(this.stripCost) : products;
  }

  private stripCost(product: Product): Omit<Product, 'cost'> {
    const { cost: _cost, ...rest } = product;
    return rest;
  }

  // Dashboard administrativo: "alertas de estoque" citados no escopo original.
  @Roles(Role.ADMIN, Role.MANAGER)
  @Get('low-stock')
  findLowStock() {
    return this.inventoryService.findLowStock();
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.MECHANIC)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.inventoryService.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post(':id/adjust-stock')
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(id, dto);
  }
}
