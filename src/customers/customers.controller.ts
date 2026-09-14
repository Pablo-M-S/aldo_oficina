import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT)
  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  // Precisa vir ANTES de ':id' — aqui os dois têm o mesmo formato de path
  // (um segmento), então 'me' seria capturado como valor de :id se viesse
  // depois. Diferente do caso de 'by-customer/:id' nos outros controllers,
  // que tem formato de path diferente e não colide.
  @Roles(Role.CUSTOMER)
  @Get('me')
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.findMe(user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.findOne(id, user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.update(id, dto, user);
  }
}
