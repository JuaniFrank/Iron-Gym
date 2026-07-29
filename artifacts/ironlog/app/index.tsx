import { Redirect } from "expo-router";

// Entry point: redirect to auth. When real auth is implemented,
// this will check session state and redirect to (tabs) if logged in.
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}