import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Post()
  create(
    @Body() dto: CreateVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
  ) {
    return this.vehiclesService.create(dto, user, customerId);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.MECHANIC)
  @Get()
  search(@Query('q') query?: string) {
    return this.vehiclesService.search(query);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Get('by-customer/:customerId')
  findAllForCustomer(@Param('customerId') customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.findAllForCustomer(customerId, user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.MECHANIC, Role.CUSTOMER)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.findOne(id, user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.vehiclesService.update(id, dto, user);
  }
}
