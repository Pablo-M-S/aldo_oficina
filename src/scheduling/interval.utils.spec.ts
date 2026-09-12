import { addMinutes, hasConflict, intervalsOverlap, isValidInterval } from './interval.utils';

const at = (hour: number, minute = 0) => new Date(2026, 0, 1, hour, minute, 0, 0);

describe('intervalsOverlap', () => {
  it('detecta sobreposição parcial no início', () => {
    const a = { startsAt: at(9), endsAt: at(10) };
    const b = { startsAt: at(9, 30), endsAt: at(10, 30) };
    expect(intervalsOverlap(a, b)).toBe(true);
  });

  it('detecta sobreposição total (um intervalo contém o outro)', () => {
    const a = { startsAt: at(8), endsAt: at(13) };
    const b = { startsAt: at(9), endsAt: at(10) };
    expect(intervalsOverlap(a, b)).toBe(true);
  });

  it('não considera conflito quando os intervalos apenas se tocam', () => {
    const a = { startsAt: at(9), endsAt: at(9, 30) };
    const b = { startsAt: at(9, 30), endsAt: at(10) };
    expect(intervalsOverlap(a, b)).toBe(false);
  });

  it('não considera conflito quando os intervalos são totalmente separados', () => {
    const a = { startsAt: at(9), endsAt: at(9, 30) };
    const b = { startsAt: at(14), endsAt: at(15) };
    expect(intervalsOverlap(a, b)).toBe(false);
  });

  it('é simétrica: overlap(a,b) === overlap(b,a)', () => {
    const a = { startsAt: at(14), endsAt: at(15) };
    const b = { startsAt: at(14, 30), endsAt: at(14, 45) };
    expect(intervalsOverlap(a, b)).toBe(intervalsOverlap(b, a));
  });
});

describe('hasConflict', () => {
  it('retorna true se o candidato colide com algum intervalo existente', () => {
    const existing = [
      { startsAt: at(8), endsAt: at(13) }, // troca de embreagem 08:00-13:00
      { startsAt: at(14), endsAt: at(15) }, // alinhamento 14:00-15:00
    ];
    const candidate = { startsAt: at(14, 30), endsAt: at(15, 30) };
    expect(hasConflict(candidate, existing)).toBe(true);
  });

  it('retorna false se o candidato cabe nos espaços livres', () => {
    const existing = [
      { startsAt: at(8), endsAt: at(13) },
      { startsAt: at(14), endsAt: at(15) },
    ];
    const candidate = { startsAt: at(9, 0), endsAt: at(9, 30) }; // pertence a outro recurso na prática
    // Aqui simulamos que já filtramos por recurso antes de chamar hasConflict;
    // este teste cobre apenas a matemática de intervalos.
    expect(hasConflict(candidate, [])).toBe(false);
    expect(hasConflict({ startsAt: at(13), endsAt: at(14) }, existing)).toBe(false);
  });

  it('lista vazia nunca gera conflito', () => {
    expect(hasConflict({ startsAt: at(9), endsAt: at(10) }, [])).toBe(false);
  });
});

describe('addMinutes', () => {
  it('soma minutos corretamente, incluindo virada de hora', () => {
    const result = addMinutes(at(9, 45), 30);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(15);
  });

  it('duração de 5h (troca de embreagem) fecha às 13:00 partindo das 08:00', () => {
    const result = addMinutes(at(8), 5 * 60);
    expect(result.getHours()).toBe(13);
    expect(result.getMinutes()).toBe(0);
  });
});

describe('isValidInterval', () => {
  it('rejeita intervalo onde o fim é anterior ou igual ao início', () => {
    expect(isValidInterval({ startsAt: at(10), endsAt: at(9) })).toBe(false);
    expect(isValidInterval({ startsAt: at(10), endsAt: at(10) })).toBe(false);
  });

  it('aceita intervalo válido', () => {
    expect(isValidInterval({ startsAt: at(9), endsAt: at(10) })).toBe(true);
  });
});
