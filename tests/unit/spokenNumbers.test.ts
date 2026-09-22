import { extractEnglishSpokenNumber } from '@/src/domain/spokenNumbers';

describe('English spoken numbers', () => {
  it.each([
    ['paid twelve hundred for fuel', '1200'],
    ['spent one thousand two hundred and fifty', '1250'],
    ['salary one lakh twenty thousand', '120000'],
    ['income two crore five lakh', '20500000'],
    ['paid twelve point five', '12.5'],
    ['paid a hundred rupees', '100'],
  ])('extracts %s', (transcript, expected) => {
    expect(extractEnglishSpokenNumber(transcript)).toBe(expected);
  });

  it('does not treat ordinary articles as amounts', () => {
    expect(extractEnglishSpokenNumber('paid for a coffee')).toBeNull();
  });
});
