import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CHECKPOINT_KEY,
  clearCheckpoint,
  readCheckpoint,
  writeCheckpoint,
} from '@/data/checkpoint';

jest.mock('@react-native-async-storage/async-storage', () => {
  const state = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => state.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        state.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        state.delete(key);
      }),
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

describe('checkpoint persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('round-trips a checkpoint through the versioned key', async () => {
    const checkpoint = { questId: 'quest-123', startedAtEpochMs: 1_800_000_000_000 };
    await writeCheckpoint(checkpoint);
    await expect(readCheckpoint()).resolves.toEqual(checkpoint);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(CHECKPOINT_KEY, JSON.stringify(checkpoint));
  });

  it('reads null when nothing was written', async () => {
    await expect(readCheckpoint()).resolves.toBeNull();
  });

  it('reads null for corrupted JSON under the key', async () => {
    await AsyncStorage.setItem(CHECKPOINT_KEY, '{not json');
    await expect(readCheckpoint()).resolves.toBeNull();
  });

  it('reads null for a foreign shape under the key', async () => {
    await AsyncStorage.setItem(CHECKPOINT_KEY, JSON.stringify({ questId: 42, when: 'now' }));
    await expect(readCheckpoint()).resolves.toBeNull();
  });

  it('reads null when startedAtEpochMs is not finite', async () => {
    await AsyncStorage.setItem(
      CHECKPOINT_KEY,
      JSON.stringify({ questId: 'q', startedAtEpochMs: NaN }),
    );
    await expect(readCheckpoint()).resolves.toBeNull();
  });

  it('clear removes the key and makes reads null', async () => {
    await writeCheckpoint({ questId: 'quest-1', startedAtEpochMs: 1234 });
    await clearCheckpoint();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CHECKPOINT_KEY);
    await expect(readCheckpoint()).resolves.toBeNull();
  });
});
