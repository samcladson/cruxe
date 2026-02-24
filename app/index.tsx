import { Redirect } from "expo-router";

export default function Index() {
  // Always route to onboarding in a fresh launch mock
  return <Redirect href="/(auth)/onboarding" />;
}
