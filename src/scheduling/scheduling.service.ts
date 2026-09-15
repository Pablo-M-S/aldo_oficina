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
   *
   * dto.resourceId é opcional: quando informado (uso típico do staff, que
   * conhece a operação interna), o agendamento é criado exatamente nesse
   * recurso. Quando omitido (uso típico do cliente no site/app, que não
   * deveria precisar saber o que é um "Elevador 2"), o backend escolhe
   * automaticamente o primeiro recurso compatível e livre no horário.
   */
  async createAppointment(dto: CreateAppointmentDto, requester: AuthenticatedUser) {
    const customerId = await this.resolveCustomerId(dto.customerId, requester);

    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service || !service.isActive) {
      throw new NotFoundException('Serviço não encontrado ou inativo.');
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

    if (dto.resourceId) {
      const resource = await this.prisma.resource.findUnique({ where: { id: dto.resourceId } });
      if (!resource || !resource.isActive) {
        throw new NotFoundException('Recurso não encontrado ou inativo.');
      }
      if (service.requiredResourceType && service.requiredResourceType !== resource.type) {
        throw new BadRequestException(
          `Este serviço exige um recurso do tipo ${service.requiredResourceType}.`,
        );
      }

      return this.createAppointmentOnResource(dto.resourceId, {
        customerId,
        vehicleId: dto.vehicleId,
        serviceId: dto.serviceId,
        startsAt,
        endsAt,
        notes: dto.notes,
      });
    }

    const candidateResources = await this.findCompatibleResources(service.requiredResourceType);
    if (candidateResources.length === 0) {
      throw new NotFoundException('Nenhum recurso disponível para este tipo de serviço.');
    }

    for (const resource of candidateResources) {
      try {
        return await this.createAppointmentOnResource(resource.id, {
          customerId,
          vehicleId: dto.vehicleId,
          serviceId: dto.serviceId,
          startsAt,
          endsAt,
          notes: dto.notes,
        });
      } catch (error) {
        // Este recurso específico estava ocupado — tenta o próximo. Qualquer
        // outro tipo de erro (não relacionado a conflito de horário) deve
        // interromper a tentativa e subir normalmente.
        if (error instanceof ConflictException) continue;
        throw error;
      }
    }

    throw new ConflictException(
      'Não há recurso livre para este serviço nesse horário. Escolha outro horário.',
    );
  }

  private async findCompatibleResources(requiredResourceType: string | null) {
    return this.prisma.resource.findMany({
      where: {
        isActive: true,
        ...(requiredResourceType ? { type: requiredResourceType } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  private async createAppointmentOnResource(
    resourceId: string,
    data: {
      customerId: string;
      vehicleId: string;
      serviceId: string;
      startsAt: Date;
      endsAt: Date;
      notes?: string;
    },
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        // Busca apenas os agendamentos ativos do MESMO recurso que possam
        // se sobrepor à janela candidata — filtro por recurso é o que torna
        // a disponibilidade calculada por recurso, e não por horário global.
        const conflicting = await tx.appointment.findMany({
          where: {
            resourceId,
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            startsAt: { lt: data.endsAt },
            endsAt: { gt: data.startsAt },
          },
          select: { id: true, startsAt: true, endsAt: true },
        });

        if (hasConflict({ startsAt: data.startsAt, endsAt: data.endsAt }, conflicting)) {
          throw new ConflictException(
            'O recurso selecionado já está ocupado nesse intervalo. Escolha outro horário ou recurso.',
          );
        }

        return tx.appointment.create({
          data: {
            customerId: data.customerId,
            vehicleId: data.vehicleId,
            serviceId: data.serviceId,
            resourceId,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
            notes: data.notes,
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
   * Lista os agendamentos de um dia (agenda administrativa). Sem filtro por
   * customerId de propósito — esta rota é só para staff (ver RolesGuard no
   * controller); o cliente vê os próprios agendamentos por outro caminho.
   */
  async findForDate(date: string) {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);

    return this.prisma.appointment.findMany({
      where: { startsAt: { gte: dayStart, lte: dayEnd } },
      include: {
        customer: { include: { user: { select: { name: true } } } },
        vehicle: true,
        service: true,
        resource: true,
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  /**
   * Gera os horários livres em uma data, em passos de 30min, dentro do
   * expediente da oficina. Dois modos:
   * - dto.resourceId informado: disponibilidade daquele recurso específico
   *   (uso do staff, que decide manualmente qual recurso usar).
   * - dto.resourceId omitido: agrega a disponibilidade de todos os recursos
   *   compatíveis com o serviço — é o que o site/app do cliente usa, sem
   *   precisar expor o conceito de "recurso" a quem está agendando.
   */
  async checkAvailability(dto: CheckAvailabilityDto) {
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service) {
      throw new NotFoundException('Serviço não encontrado.');
    }

    if (dto.resourceId) {
      const slots = await this.computeFreeSlots(dto.resourceId, service.durationMinutes, dto.date);
      return { resourceId: dto.resourceId, date: dto.date, availableSlots: slots };
    }

    const resources = await this.findCompatibleResources(service.requiredResourceType);
    const slotsByResource = await Promise.all(
      resources.map((resource) => this.computeFreeSlots(resource.id, service.durationMinutes, dto.date)),
    );

    // Une os horários livres de todos os recursos compatíveis, sem repetir
    // o mesmo horário de início duas vezes — o cliente só precisa saber
    // "dá pra agendar às 9h", não em qual recurso especificamente isso cai
    // (isso é decidido em createAppointment, no momento da confirmação).
    const seen = new Set<number>();
    const merged: { startsAt: Date; endsAt: Date }[] = [];
    for (const slots of slotsByResource) {
      for (const slot of slots) {
        const key = slot.startsAt.getTime();
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(slot);
        }
      }
    }
    merged.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    return { serviceId: dto.serviceId, date: dto.date, availableSlots: merged };
  }

  private async computeFreeSlots(
    resourceId: string,
    durationMinutes: number,
    date: string,
  ): Promise<{ startsAt: Date; endsAt: Date }[]> {
    const dayStart = new Date(`${date}T00:00:00`);
    const windowStart = new Date(dayStart);
    windowStart.setHours(BUSINESS_START_HOUR, 0, 0, 0);
    const windowEnd = new Date(dayStart);
    windowEnd.setHours(BUSINESS_END_HOUR, 0, 0, 0);

    const existing = await this.prisma.appointment.findMany({
      where: {
        resourceId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startsAt: { lt: windowEnd },
        endsAt: { gt: windowStart },
      },
      select: { startsAt: true, endsAt: true },
    });

    const slots: { startsAt: Date; endsAt: Date }[] = [];
    let cursor = new Date(windowStart);

    while (cursor < windowEnd) {
      const candidateEnd = addMinutes(cursor, durationMinutes);
      if (candidateEnd > windowEnd) break;

      const candidate: TimeInterval = { startsAt: new Date(cursor), endsAt: candidateEnd };
      if (!hasConflict(candidate, existing)) {
        slots.push(candidate);
      }

      cursor = addMinutes(cursor, SLOT_STEP_MINUTES);
    }

    return slots;
  }
}
