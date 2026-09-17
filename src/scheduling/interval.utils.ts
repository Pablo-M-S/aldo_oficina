export interface TimeInterval {
  startsAt: Date;
  endsAt: Date;
}

/**
 * Verifica se dois intervalos de tempo se sobrepõem.
 * Regra: dois intervalos [a.start, a.end) e [b.start, b.end) se sobrepõem
 * se e somente se a.start < b.end E b.start < a.end.
 * Intervalos "encostados" (um termina exatamente quando o outro começa)
 * NÃO são considerados conflito — 09:00–09:30 e 09:30–10:00 podem coexistir.
 */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

/**
 * Dado um intervalo candidato e uma lista de intervalos já ocupados no mesmo
 * recurso, retorna true se o candidato conflita com QUALQUER um deles.
 */
export function hasConflict(candidate: TimeInterval, existing: TimeInterval[]): boolean {
  return existing.some((occupied) => intervalsOverlap(candidate, occupied));
}

/**
 * Calcula o horário de término a partir do início e da duração em minutos.
 */
export function addMinutes(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60_000);
}

export function isValidInterval(interval: TimeInterval): boolean {
  return interval.startsAt.getTime() < interval.endsAt.getTime();
}

/**
 * `referenceNow` existe só pra permitir teste determinístico (injetar um
 * "agora" fixo); em produção sempre é chamada sem o segundo argumento.
 */
export function isInPast(date: Date, referenceNow: Date = new Date()): boolean {
  return date.getTime() < referenceNow.getTime();
}
