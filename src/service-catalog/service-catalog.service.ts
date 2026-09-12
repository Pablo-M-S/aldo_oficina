import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServiceCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateServiceDto) {
    return this.prisma.service.create({ data: dto });
  }

  findAll(onlyActive = true) {
    return this.prisma.service.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Serviço não encontrado.');
    }
    return service;
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: { isActive: false } });
  }
}
