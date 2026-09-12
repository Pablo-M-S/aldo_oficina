import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateResourceDto) {
    return this.prisma.resource.create({ data: dto });
  }

  findAll(onlyActive = true) {
    return this.prisma.resource.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) {
      throw new NotFoundException('Recurso não encontrado.');
    }
    return resource;
  }

  async update(id: string, dto: UpdateResourceDto) {
    await this.findOne(id);
    return this.prisma.resource.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft delete: um recurso nunca é apagado fisicamente porque agendamentos
    // e ordens de serviço passadas continuam referenciando-o.
    return this.prisma.resource.update({ where: { id }, data: { isActive: false } });
  }
}
