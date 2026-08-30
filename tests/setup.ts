jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(Math.random()).slice(2, 14).padEnd(12, '0')}`) }));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-PK', currencyCode: 'PKR' }],
  getCalendars: () => [{ timeZone: 'Asia/Karachi' }],
}));
