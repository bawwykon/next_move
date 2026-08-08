/**
 * S8-02 live-DB proof (FR-COS-1/2): the equip write path — equip an owned
 * item, swap, unequip, reject unowned silently, and prove the progression
 * guard refuses a mixed update that also touches `level` in the same
 * statement. Sequential by design (each step's assertions depend on the
 * previous). The demo's owned set is handled by the seed (frame-default,
 * title-adventurer, portrait-default); a `supabase db reset` restores it.
 * Run explicitly (excluded from CI):
 *   npx jest tests/integration --testPathIgnorePatterns=/node_modules/
 */
import { installNativeFetch } from './setup-native-fetch';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => store.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      store.delete(key);
    },
  };
});

const DEMO_EMAIL = 'demo@nextmove.app';
const DEMO_PASSWORD = 'demo-pass-123';

const nullState = { frame: null, title: null, background: null, portrait: null };

describe('cosmetic equip data path (live local supabase)', () => {
  let board: typeof import('../../src/data/repositories/board');
  let cosmeticsRepo: typeof import('../../src/data/repositories/cosmetics');
  let profileCosmetics: typeof import('../../src/data/repositories/profileCosmetics');
  let loadout: typeof import('../../src/domain/cosmetics/loadout');
  let supabase: typeof import('../../src/data/supabase').supabase;
  let profileId: string;

  const catalogId = (slug: string): string =>
    catalogRefs.find((item) => item.slug === slug)?.id ?? '';

  let catalogRefs: { id: string; slug: string; name: string; kind: string }[] = [];

  beforeAll(async () => {
    installNativeFetch();
    board = jest.requireActual('../../src/data/repositories/board');
    cosmeticsRepo = jest.requireActual('../../src/data/repositories/cosmetics');
    profileCosmetics = jest.requireActual('../../src/data/repositories/profileCosmetics');
    loadout = jest.requireActual('../../src/domain/cosmetics/loadout');
    supabase = jest.requireActual('../../src/data/supabase').supabase;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    if (error || !data.user) {
      throw new Error(`sign in failed: ${error?.message}`);
    }
    profileId = data.user.id;
    catalogRefs = (await cosmeticsRepo.fetchCosmeticCatalog()).data ?? [];
  }, 30_000);

  const readEquipped = async (): Promise<{
    frame: string | null;
    title: string | null;
    background: string | null;
    portrait: string | null;
  }> => (await board.fetchProfile(profileId)).data?.equipped ?? nullState;

  it('the demo owns exactly the seed-granted items (3 of 18)', async () => {
    const rows = (await profileCosmetics.fetchProfileCosmetics(profileId)).data ?? [];
    expect(rows.map((row) => row.slug).sort()).toEqual([
      'frame-default',
      'portrait-default',
      'title-adventurer',
    ]);
    const owned = loadout.ownedBySlug(rows);
    for (const slug of ['frame-default', 'title-adventurer', 'portrait-default']) {
      expect(owned.has(slug)).toBe(true);
    }
  });

  it('(1) equips an owned item — equipped_frame becomes its uuid', async () => {
    const result = await board.equipCosmetic(profileId, 'frame', catalogId('frame-default'));
    expect(result.error).toBeNull();
    const equipped = await readEquipped();
    expect(equipped.frame).toBe(catalogId('frame-default'));
  });

  it('(2) swaps to another owned item', async () => {
    const result = await board.equipCosmetic(profileId, 'title', catalogId('title-adventurer'));
    expect(result.error).toBeNull();
    const equipped = await readEquipped();
    expect(equipped.title).toBe(catalogId('title-adventurer'));
    expect(equipped.frame).toBe(catalogId('frame-default'));
  });

  it('(3) unequips — equipped_title becomes null', async () => {
    const result = await board.equipCosmetic(profileId, 'title', null);
    expect(result.error).toBeNull();
    const equipped = await readEquipped();
    expect(equipped.title).toBeNull();
  });

  it('(4) unowned equip is rejected by the write path; state unchanged', async () => {
    const before = await readEquipped();
    const result = await board.equipCosmetic(profileId, 'portrait', catalogId('portrait-master'));
    expect(result.error).not.toBeNull();
    expect(result.error).toContain('not owned');
    const after = await readEquipped();
    expect(after).toEqual(before);
  });

  it('(5) a mixed update touching level + equipped is rejected wholesale', async () => {
    const before = await readEquipped();
    const levelBefore = (await board.fetchProfile(profileId)).data!.level;
    const { error } = await supabase
      .from('profiles')
      .update({ equipped_portrait: catalogId('portrait-master'), level: 999 })
      .eq('id', profileId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('progression');
    const after = await readEquipped();
    expect(after).toEqual(before);
    expect((await board.fetchProfile(profileId)).data!.level).toBe(levelBefore);
  });

  it('domain validation matches the repo gate on the same data', async () => {
    const ownedSet = loadout.ownedBySlug(
      (await profileCosmetics.fetchProfileCosmetics(profileId)).data ?? [],
    );
    expect(
      loadout.validateEquip('frame', catalogId('frame-default'), ownedSet, catalogRefs),
    ).toEqual({
      ok: true,
    });
    expect(
      loadout.validateEquip('portrait', catalogId('portrait-master'), ownedSet, catalogRefs),
    ).toEqual({ ok: false, reason: 'NOT_OWNED' });
  });
});
