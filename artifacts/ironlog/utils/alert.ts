import { Alert, Platform } from "react-native";

import { presentAlert, type DialogButton } from "@/utils/dialog";

/**
 * Drop-in replacement for `Alert.alert` that also works on web (where the
 * react-native-web implementation is a no-op). See `utils/dialog.ts` for the
 * web button mapping.
 */
export function showAlert(title: string, message?: string, buttons?: DialogButton[]): void {
  presentAlert(title, message, buttons, {
    isWeb: Platform.OS === "web",
    confirm: (m) => (typeof window !== "undefined" ? window.confirm(m) : true),
    alert: (m) => {
      if (typeof window !== "undefined") window.alert(m);
    },
    nativeAlert: (t, m, b) => Alert.alert(t, m, b),
  });
}
