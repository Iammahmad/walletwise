import { getZonedParts, monthBounds, resolveSpokenDate } from '@/src/domain/dates';

describe('timezone-aware relative dates', () => {
  const reference = new Date('2026-08-30T10:15:00.000Z'); // Sunday, 15:15 in Karachi

  it('keeps today at the reference instant', () => {
    expect(resolveSpokenDate('paid today', reference, 'Asia/Karachi')).toBe(reference.toISOString());
  });

  it('resolves yesterday in the user timezone while keeping wall-clock time', () => {
    expect(resolveSpokenDate('paid yesterday', reference, 'Asia/Karachi')).toBe('2026-08-29T10:15:00.000Z');
  });

  it('resolves a weekday to the previous occurrence', () => {
    expect(resolveSpokenDate('paid Friday', reference, 'Asia/Karachi')).toBe('2026-08-28T10:15:00.000Z');
  });

  it('resolves ISO and day-first explicit dates at local noon', () => {
    expect(resolveSpokenDate('on 2026-08-12', reference, 'Asia/Karachi')).toBe('2026-08-12T07:00:00.000Z');
    expect(resolveSpokenDate('on 12/08/2026', reference, 'Asia/Karachi')).toBe('2026-08-12T07:00:00.000Z');
  });

  it('returns exact month bounds for the timezone', () => {
    const bounds = monthBounds(reference, 'Asia/Karachi');
    expect(bounds).toEqual({ start: '2026-07-31T19:00:00.000Z', end: '2026-08-31T19:00:00.000Z' });
    expect(getZonedParts(new Date(bounds.start), 'Asia/Karachi')).toMatchObject({ year: 2026, month: 8, day: 1, hour: 0 });
  });
});
