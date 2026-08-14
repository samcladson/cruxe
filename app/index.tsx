import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

export default function Index() {
  const hasCompletedOnboarding = useSettingsStore(
    (s) => s.hasCompletedOnboarding,
  );
  const [ready, setReady] = useState(() =>
    useSettingsStore.persist.hasHydrated(),
  );

  useEffect(() => {
    if (useSettingsStore.persist.hasHydrated()) {
      setReady(true);
      return;
    }
    return useSettingsStore.persist.onFinishHydration(() => setReady(true));
  }, []);

  if (!ready) {
    return null;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }
  return <Redirect href="/(tabs)" />;
}
