import { I18n } from '../lib/i18n';
import * as fs from 'fs-extra';

// fs-extra's properties are not configurable, so jest.spyOn cannot patch
// readJson in place; replace the module with a delegating mock instead.
jest.mock('fs-extra', () => {
  const actual = jest.requireActual('fs-extra');
  return { ...actual, readJson: jest.fn(actual.readJson) };
});

const actualFs = jest.requireActual('fs-extra');
const readJsonMock = fs.readJson as unknown as jest.Mock;

// Regression test for the flaky "English output right after switching to ja"
// CI failure: TaskManager's constructor used to fire an un-awaited
// i18n.init('en') whose en.json read could resolve AFTER a later init('ja'),
// clobbering the Japanese messages. loadMessages() must discard stale loads.
describe('I18n stale load protection', () => {
  let i18n: I18n;

  beforeEach(async () => {
    readJsonMock.mockImplementation(actualFs.readJson);
    i18n = I18n.getInstance();
    await i18n.init('en');
  });

  afterEach(async () => {
    readJsonMock.mockImplementation(actualFs.readJson);
    await i18n.init('en');
  });

  it('keeps the latest language when an earlier init resolves late', async () => {
    let releaseEn: (() => void) | undefined;
    const enGate = new Promise<void>((resolve) => {
      releaseEn = resolve;
    });

    readJsonMock.mockImplementation(async (file: string) => {
      if (String(file).endsWith('en.json')) {
        await enGate;
      }
      return actualFs.readJson(file);
    });

    // Simulate the race: an un-awaited init('en') (as TaskManager's
    // constructor used to do) still in flight when init('ja') completes.
    const staleEnInit = i18n.init('en');
    await i18n.init('ja');
    expect(i18n.t('commands.status.title')).toBe('📊 タスクステータス:');

    // Let the stale English load land after the Japanese one.
    releaseEn!();
    await staleEnInit;

    expect(i18n.getLanguage()).toBe('ja');
    expect(i18n.t('commands.status.title')).toBe('📊 タスクステータス:');
  });

  it('still falls back to English when the requested language file is missing', async () => {
    readJsonMock.mockImplementation(async (file: string) => {
      if (String(file).endsWith('ja.json')) {
        throw new Error('ENOENT');
      }
      return actualFs.readJson(file);
    });

    await i18n.init('ja');

    expect(i18n.getLanguage()).toBe('en');
    expect(i18n.t('commands.status.title')).toBe('📊 Task Status:');
  });
});
