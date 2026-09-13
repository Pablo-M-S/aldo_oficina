import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleFromCartDto } from './dto/create-sale-from-cart.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Post('checkout')
  createFromCart(@Body() dto: CreateSaleFromCartDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.createFromCart(dto, user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT)
  @Post('from-work-order/:workOrderId')
  createFromWorkOrder(
    @Param('workOrderId') workOrderId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.createFromWorkOrder(workOrderId, user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.findOne(id, user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Get('by-customer/:customerId')
  findAllForCustomer(@Param('customerId') customerId: string) {
    return this.salesService.findAllForCustomer(customerId);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT)
  @Post(':id/payments')
  registerPayment(
    @Param('id') id: string,
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.registerPayment(id, dto, user);
  }
}
