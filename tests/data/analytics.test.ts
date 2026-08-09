import AsyncStorage from '@react-native-async-storage/async-storage';

import { ANALYTICS_KEY, ANALYTICS_MAX_EVENTS, track } from '@/data/analytics';

jest.mock('@react-native-async-storage/async-storage', () => {
  const state = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => state.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        state.set(key, value);
      }),
      removeItem: jest.fn(async () => {}),
      mergeItem: jest.fn(async () => {}),
      clear: jest.fn(async () => {
        state.clear();
      }),
      getAllKeys: jest.fn(async () => Array.from(state.keys())),
      multiGet: jest.fn(async () => []),
      multiSet: jest.fn(async () => {}),
      multiRemove: jest.fn(async () => {}),
      multiMerge: jest.fn(async () => {}),
      flushGetRequests: jest.fn(),
    },
  } as unknown as typeof AsyncStorage;
});

describe('analytics (NFR-9 privacy-lean log)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('stores events in append order with timestamps', async () => {
    await track('app_opened');
    await track('quest_started', { questId: 'q-1' });
    const events = JSON.parse((await AsyncStorage.getItem(ANALYTICS_KEY)) ?? '[]') as {
      event: string;
      props: Record<string, unknown>;
      at: string;
    }[];
    expect(events.map((e) => e.event)).toEqual(['app_opened', 'quest_started']);
    expect(events[1]!.props).toEqual({ questId: 'q-1' });
    expect(Number.isNaN(Date.parse(events[0]!.at))).toBe(false);
  });

  it('caps the log at the maximum', async () => {
    for (let i = 0; i < ANALYTICS_MAX_EVENTS + 25; i += 1) {
      await track('quest_completed', { questId: `q-${i}` });
    }
    const events = JSON.parse((await AsyncStorage.getItem(ANALYTICS_KEY)) ?? '[]') as unknown[];
    expect(events).toHaveLength(ANALYTICS_MAX_EVENTS);
  });

  it('never throws when storage is broken (e.g. full disk)', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(track('app_opened')).resolves.toBeUndefined();
  });
});
