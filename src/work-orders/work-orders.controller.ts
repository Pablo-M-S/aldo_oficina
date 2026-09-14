import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkOrdersService } from './work-orders.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { AddWorkOrderItemDto } from './dto/add-work-order-item.dto';
import { UpdateWorkOrderStatusDto } from './dto/update-work-order-status.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('work-orders')
@ApiBearerAuth()
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Post()
  create(@Body() dto: CreateWorkOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.create(dto, user);
  }

  // Rotas estáticas ('', 'by-customer/:id') declaradas antes de ':id' por
  // convenção de legibilidade. Não há ambiguidade real de roteamento aqui —
  // cada uma tem uma quantidade diferente de segmentos de path — mas manter
  // as fixas primeiro evita qualquer dúvida ao adicionar rotas novas depois.
  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.MECHANIC)
  @Get()
  findAllOpen() {
    return this.workOrdersService.findAllOpen();
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Get('by-customer/:customerId')
  findAllForCustomer(@Param('customerId') customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.findAllForCustomer(customerId, user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.MECHANIC, Role.CUSTOMER)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workOrdersService.findOne(id, user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.MECHANIC)
  @Post(':id/items')
  addItem(
    @Param('id') id: string,
    @Body() dto: AddWorkOrderItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.addItem(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.MECHANIC)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateWorkOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workOrdersService.updateStatus(id, dto, user);
  }
}
