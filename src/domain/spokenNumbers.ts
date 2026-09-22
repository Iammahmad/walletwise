const SMALL_NUMBERS: Readonly<Record<string, number>> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Readonly<Record<string, number>> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const SCALES: Readonly<Record<string, bigint>> = {
  thousand: 1_000n,
  lakh: 100_000n,
  lac: 100_000n,
  million: 1_000_000n,
  crore: 10_000_000n,
  billion: 1_000_000_000n,
};

function isNumberWord(word: string): boolean {
  return word in SMALL_NUMBERS
    || word in TENS
    || word in SCALES
    || word === 'hundred'
    || word === 'point';
}

function parseNumberPhrase(words: readonly string[]): string | null {
  let total = 0n;
  let current = 0n;
  let sawValue = false;

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;
    if (word === 'and') {
      if (!sawValue) return null;
      continue;
    }
    if (word === 'a' || word === 'an') {
      const next = words[index + 1];
      if (next !== 'hundred' && !(next && next in SCALES)) return null;
      current += 1n;
      sawValue = true;
      continue;
    }
    if (word in SMALL_NUMBERS) {
      current += BigInt(SMALL_NUMBERS[word]!);
      sawValue = true;
      continue;
    }
    if (word in TENS) {
      current += BigInt(TENS[word]!);
      sawValue = true;
      continue;
    }
    if (word === 'hundred') {
      current = (current || 1n) * 100n;
      sawValue = true;
      continue;
    }
    if (word in SCALES) {
      current = current || 1n;
      total += current * SCALES[word]!;
      current = 0n;
      sawValue = true;
      continue;
    }
    if (word === 'point') {
      if (!sawValue) return null;
      const fractionWords = words.slice(index + 1);
      if (!fractionWords.length) return null;
      const fraction = fractionWords.map((fractionWord) => {
        const value = SMALL_NUMBERS[fractionWord];
        return value != null && value <= 9 ? String(value) : null;
      });
      if (fraction.some((digit) => digit == null)) return null;
      return `${total + current}.${fraction.join('')}`;
    }
    return null;
  }

  return sawValue ? String(total + current) : null;
}

export function extractEnglishSpokenNumber(text: string): string | null {
  const words = text.toLowerCase().replace(/-/g, ' ').match(/[a-z]+/g) ?? [];
  for (let start = 0; start < words.length; start += 1) {
    const first = words[start]!;
    const articleStartsNumber = (first === 'a' || first === 'an')
      && (words[start + 1] === 'hundred' || Boolean(words[start + 1] && words[start + 1]! in SCALES));
    if (!isNumberWord(first) && !articleStartsNumber) continue;

    let end = start;
    while (end + 1 < words.length) {
      const next = words[end + 1]!;
      if (isNumberWord(next)) {
        end += 1;
        continue;
      }
      if (next === 'and' && words[end + 2] && isNumberWord(words[end + 2]!)) {
        end += 1;
        continue;
      }
      break;
    }

    for (let candidateEnd = end; candidateEnd >= start; candidateEnd -= 1) {
      const parsed = parseNumberPhrase(words.slice(start, candidateEnd + 1));
      if (parsed && parsed !== '0') return parsed;
    }
  }
  return null;
}
