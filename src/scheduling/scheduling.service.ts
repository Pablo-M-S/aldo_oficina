import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Role } from '../common/enums/role.enum';
import { addMinutes, hasConflict, isValidInterval, TimeInterval } from './interval.utils';

const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;
const SLOT_STEP_MINUTES = 30;

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCustomerId(
    requestedCustomerId: string | undefined,
    requester: AuthenticatedUser,
  ): Promise<string> {
    if (requester.role !== Role.CUSTOMER) {
      if (!requestedCustomerId) {
        throw new BadRequestException('Informe o customerId ao agendar em nome de um cliente.');
      }
      return requestedCustomerId;
    }

    const ownCustomer = await this.prisma.customer.findUnique({
      where: { userId: requester.sub },
    });
    if (!ownCustomer) {
      throw new NotFoundException('Cadastro de cliente não encontrado para este usuário.');
    }
    return ownCustomer.id;
  }

  /**
   * Cria um agendamento garantindo, de forma atômica, que o recurso escolhido
   * não tenha nenhum outro compromisso sobreposto no intervalo solicitado.
   *
   * A checagem de conflito acontece DENTRO da transação, com isolamento
   * Serializable: isso evita a condição de corrida clássica de duas
   * requisições simultâneas lendo "livre" e ambas inserindo o mesmo horário.
   * Sem isso, a checagem em código (hasConflict) sozinha não é suficiente
   * sob concorrência real.
   */
  async createAppointment(dto: CreateAppointmentDto, requester: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(dto.customerId, requester);

    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service || !service.isActive) {
      throw new NotFoundException('Serviço não encontrado ou inativo.');
    }

    const resource = await this.prisma.resource.findUnique({ where: { id: dto.resourceId } });
    if (!resource || !resource.isActive) {
      throw new NotFoundException('Recurso não encontrado ou inativo.');
    }

    if (service.requiredResourceType && service.requiredResourceType !== resource.type) {
      throw new BadRequestException(
        `Este serviço exige um recurso do tipo ${service.requiredResourceType}.`,
      );
    }

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle || vehicle.customerId !== customerId) {
      throw new NotFoundException('Veículo não encontrado para este cliente.');
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = addMinutes(startsAt, service.durationMinutes);
    const candidate: TimeInterval = { startsAt, endsAt };

    if (!isValidInterval(candidate)) {
      throw new BadRequestException('Intervalo de agendamento inválido.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Busca apenas os agendamentos ativos do MESMO recurso que possam
        // se sobrepor à janela candidata — filtro por recurso é o que torna
        // a disponibilidade calculada por recurso, e não por horário global.
        const conflicting = await tx.appointment.findMany({
          where: {
            resourceId: dto.resourceId,
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: { id: true, startsAt: true, endsAt: true },
        });

        if (hasConflict(candidate, conflicting)) {
          throw new ConflictException(
            'O recurso selecionado já está ocupado nesse intervalo. Escolha outro horário ou recurso.',
          );
        }

        return tx.appointment.create({
          data: {
            customerId,
            vehicleId: dto.vehicleId,
            serviceId: dto.serviceId,
            resourceId: dto.resourceId,
            startsAt,
            endsAt,
            notes: dto.notes,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async cancelAppointment(id: string, requester: AuthenticatedUser) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado.');
    }

    const isOwner = appointment.customer.userId === requester.sub;
    const isStaff = requester.role !== Role.CUSTOMER;
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('Você não pode cancelar este agendamento.');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Gera os horários livres de um recurso em uma data, em passos de 30min,
   * dentro do expediente da oficina, descontando os intervalos já ocupados.
   */
  async checkAvailability(dto: CheckAvailabilityDto) {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) {
      throw new NotFoundException('Serviço não encontrado.');
    }

    const dayStart = new Date(`${dto.date}T00:00:00`);
    const windowStart = new Date(dayStart);
    windowStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    const windowEnd = new Date(dayStart);
    windowEnd.setHours(BUSINESS_END_HOUR, 0, 0, 0);

    const existing = await this.prisma.appointment.findMany({
      where: {
        resourceId: dto.resourceId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
      },
      select: { startsAt: true, endsAt: true },
    });

    const slots: { startsAt: Date; endsAt: Date }[] = [];
    let cursor = new Date(windowStart);

    while (cursor < windowEnd) {
      const candidateEnd = addMinutes(cursor, service.durationMinutes);
      if (candidateEnd > windowEnd) {
        break;
      }

      const candidate: TimeInterval = { startsAt: new Date(cursor), endsAt: candidateEnd };
      if (!hasConflict(candidate, existing)) {
        slots.push(candidate);
      }

      cursor = addMinutes(cursor, SLOT_STEP_MINUTES);
    }

    return { resourceId: dto.resourceId, date: dto.date, availableSlots: slots };
  }
}
