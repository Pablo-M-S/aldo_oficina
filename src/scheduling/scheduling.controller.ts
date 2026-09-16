import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SchedulingService } from './scheduling.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('scheduling')
@ApiBearerAuth()
@Controller('appointments')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Post()
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.schedulingService.createAppointment(dto, user);
  }

  // Agenda administrativa do dia — não confundir com o histórico do cliente.
  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.MECHANIC)
  @Get()
  findForDate(@Query('date') date: string) {
    return this.schedulingService.findForDate(date);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Get('by-customer/:customerId')
  findAllForCustomer(@Param('customerId') customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.schedulingService.findAllForCustomer(customerId, user);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Post('availability')
  checkAvailability(@Query() dto: CheckAvailabilityDto) {
    return this.schedulingService.checkAvailability(dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER, Role.ATTENDANT, Role.CUSTOMER)
  @Delete(':id')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.schedulingService.cancelAppointment(id, user);
  }
}
