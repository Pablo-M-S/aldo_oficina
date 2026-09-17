import { Injectable, Logger } from '@nestjs/common';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Serviço de notificações mínimo (stub).
 *
 * Hoje só loga a notificação; o SchedulingService já trata qualquer falha
 * daqui como best-effort (fire-and-forget), então esta implementação nunca
 * deve lançar. Quando houver um provedor real (push, e-mail, etc.), troque
 * o corpo do método mantendo a mesma assinatura.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async notifyUser(userId: string, message: NotificationPayload | string): Promise<void> {
    try {
      const payload = typeof message === 'string' ? { title: message, body: message } : message;
      this.logger.log(`Notificação para usuário ${userId}: ${payload.title} — ${payload.body}`);
    } catch (error) {
      this.logger.error('Falha ao registrar notificação', error as Error);
    }
  }
}
