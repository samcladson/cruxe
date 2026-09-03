/**
 * Account switching in the user store.
 *
 * The bug these cover: after deleting an account, the home screen still
 * showed the previous account's coins and streak. `syncFromSupabase` falls
 * back to `state.profile.*` for every field the server does not return — and
 * returns nothing at all while the signup trigger is still committing — so a
 * profile left over from the previous identity survived and was then treated
 * as the new user's own.
 */

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../services/supabaseClient", () => ({
  supabase: { from: jest.fn(), auth: {}, rpc: jest.fn() },
}));

import { useUserStore } from "../stores/userStore";

const OLD_ACCOUNT = "11111111-1111-4111-8111-111111111111";
const NEW_ACCOUNT = "22222222-2222-4222-8222-222222222222";

/** Puts the store in the state of a well-played account. */
function seedEstablishedAccount(id: string) {
  useUserStore.setState((state) => ({
    profile: {
      ...state.profile,
      id,
      displayName: "Sam Cladson",
      coins: 4820,
      currentStreak: 37,
      longestStreak: 41,
      totalScore: 91234,
      totalPuzzlesSolved: 210,
      categoryStats: {
        ...state.profile.categoryStats,
        history: { solved: 44, averageTime: 120, bestTime: 61, accuracy: 0.97 },
      },
    },
    pendingSolves: [
      {
        puzzleId: "p1",
        letters: "ABC",
        elapsedSeconds: 90,
        queuedAt: new Date().toISOString(),
      } as any,
    ],
  }));
}

describe("setUserId", () => {
  beforeEach(() => {
    useUserStore.getState().resetLocalProfile();
  });

  it("wipes the previous account's data when the identity changes", () => {
    seedEstablishedAccount(OLD_ACCOUNT);

    useUserStore.getState().setUserId(NEW_ACCOUNT);

    const { profile, pendingSolves } = useUserStore.getState();
    expect(profile.id).toBe(NEW_ACCOUNT);
    expect(profile.coins).toBe(0);
    expect(profile.currentStreak).toBe(0);
    expect(profile.longestStreak).toBe(0);
    expect(profile.totalScore).toBe(0);
    expect(profile.totalPuzzlesSolved).toBe(0);
    expect(profile.displayName).toBe("Player");
    expect(profile.categoryStats.history.solved).toBe(0);
    expect(pendingSolves).toEqual([]);
  });

  it("keeps the profile intact when the same account is set again", () => {
    // The ordinary case: a relaunch or a token refresh must not cost the
    // player their progress.
    seedEstablishedAccount(OLD_ACCOUNT);

    useUserStore.getState().setUserId(OLD_ACCOUNT);

    const { profile, pendingSolves } = useUserStore.getState();
    expect(profile.coins).toBe(4820);
    expect(profile.currentStreak).toBe(37);
    expect(profile.categoryStats.history.solved).toBe(44);
    expect(pendingSolves).toHaveLength(1);
  });

  it("adopts the first real id over the 'guest' placeholder", () => {
    expect(useUserStore.getState().profile.id).toBe("guest");

    useUserStore.getState().setUserId(NEW_ACCOUNT);

    expect(useUserStore.getState().profile.id).toBe(NEW_ACCOUNT);
    expect(useUserStore.getState().profile.coins).toBe(0);
  });

  it("leaves nothing of the old account behind across a delete-and-resignup", () => {
    // The exact reported sequence: an established account, deleted, replaced
    // by a fresh anonymous one.
    seedEstablishedAccount(OLD_ACCOUNT);

    useUserStore.getState().resetLocalProfile();
    useUserStore.getState().setUserId(NEW_ACCOUNT);

    const serialised = JSON.stringify(useUserStore.getState());
    expect(serialised).not.toContain(OLD_ACCOUNT);
    expect(serialised).not.toContain("Sam Cladson");
    expect(serialised).not.toContain("4820");
  });
});

describe("resetLocalProfile", () => {
  it("returns every field to its initial value", () => {
    seedEstablishedAccount(OLD_ACCOUNT);

    useUserStore.getState().resetLocalProfile();

    const { profile, pendingSolves } = useUserStore.getState();
    expect(profile.id).toBe("guest");
    expect(profile.coins).toBe(0);
    expect(profile.currentStreak).toBe(0);
    expect(profile.displayName).toBe("Player");
    expect(pendingSolves).toEqual([]);
  });
});
