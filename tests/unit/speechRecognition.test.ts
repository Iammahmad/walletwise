import {
  buildSpeechVocabulary,
  chooseAndroidRecognitionService,
  chooseSupportedSpeechLocale,
  selectBestTranscript,
} from '@/src/services/speechRecognition';

describe('speech recognition helpers', () => {
  it('uses the preferred locale when the recognizer supports it', () => {
    expect(chooseSupportedSpeechLocale('en-PK', ['en-US', 'en-PK'])).toBe('en-PK');
    expect(chooseSupportedSpeechLocale('en-PK', ['en-US'])).toBe('en-US');
  });

  it('prefers an installed Google recognition service over a non-Google default', () => {
    expect(chooseAndroidRecognitionService(
      ['com.samsung.android.bixby.agent', 'com.google.android.googlequicksearchbox'],
      'com.samsung.android.bixby.agent',
    )).toBe('com.google.android.googlequicksearchbox');
  });

  it('prefers the on-device Google service while offline', () => {
    expect(chooseAndroidRecognitionService(
      ['com.google.android.googlequicksearchbox', 'com.google.android.as'],
      'com.google.android.googlequicksearchbox',
      false,
    )).toBe('com.google.android.as');
  });

  it('builds vocabulary from the user accounts and finance terminology', () => {
    const vocabulary = buildSpeechVocabulary(['Cash', 'Meezan Bank'], ['Food', 'Fuel'], 'PKR');
    expect(vocabulary).toEqual(expect.arrayContaining(['Cash', 'Meezan Bank', 'rupees', 'groceries']));
  });

  it('uses confidence and finance signals to choose a useful alternative', () => {
    expect(selectBestTranscript([
      { transcript: 'I spend twelve on launch', confidence: 0.3 },
      { transcript: 'I spent 1200 on lunch', confidence: 0.86 },
      { transcript: '', confidence: 0.99 },
    ], ['spent', 'lunch'])).toBe('I spent 1200 on lunch');
  });

  it('allows domain vocabulary to correct a small confidence difference', () => {
    expect(selectBestTranscript([
      { transcript: 'I spent 1200 on launch', confidence: 0.88 },
      { transcript: 'I spent 1200 on lunch', confidence: 0.84 },
    ], ['lunch'])).toBe('I spent 1200 on lunch');
  });
});
