import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

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
  findAll() {
    return this.inventoryService.findAll();
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
