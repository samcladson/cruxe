import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { supabase } from "@/services/supabaseClient";
import { routeForSession } from "@/utils/onboardingRoute";

/**
 * The entry gate.
 *
 * The app used to sign in anonymously on launch, so a session always existed
 * and this only had to decide between the warm-up and the tabs. Guest play is
 * gone: an account now comes from signing in, so a launch with no session has
 * to go to the welcome screen instead of into the app.
 *
 * Nothing renders until both answers are known. Redirecting on a half-known
 * state would bounce a signed-in player through the sign-in screen on every
 * cold start.
 */
export default function Index() {
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding,
  );
  const [settingsReady, setSettingsReady] = useState(() =>
    useSettingsStore.persist.hasHydrated(),
  );
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (useSettingsStore.persist.hasHydrated()) {
      setSettingsReady(true);
      return;
    }
    return useSettingsStore.persist.onFinishHydration(() =>
      setSettingsReady(true),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setHasSession(Boolean(data.session));
      })
      .catch(() => {
        // Unreachable auth is not evidence of being signed out, but there is
        // no session to act on either. Sign-in is the only safe destination.
        if (!cancelled) setHasSession(false);
      });

    // Signing in and signing out both land here, so the gate follows without
    // each screen having to navigate away by hand.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setHasSession(Boolean(session));
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!settingsReady || hasSession === null) {
    return null;
  }

  return <Redirect href={routeForSession(hasSession, hasCompletedOnboarding)} />;
}
