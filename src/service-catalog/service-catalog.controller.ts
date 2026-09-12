import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ServiceCatalogService } from './service-catalog.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('service-catalog')
@ApiBearerAuth()
@Controller('services')
export class ServiceCatalogController {
  constructor(private readonly serviceCatalogService: ServiceCatalogService) {}

  @Roles(Role.ADMIN, Role.MANAGER)
  @Post()
  create(@Body() dto: CreateServiceDto) {
    return this.serviceCatalogService.create(dto);
  }

  // Catálogo público: cliente precisa ver preço e duração antes de agendar.
  @Public()
  @Get()
  findAll() {
    return this.serviceCatalogService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceCatalogService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.serviceCatalogService.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.serviceCatalogService.remove(id);
  }
}
