/**
 * Pure web/native mapping logic for `showAlert` (see `utils/alert.ts`). No
 * react-native import here so it can be unit-tested in node.
 *
 * Cross-platform replacement for `Alert.alert`.
 *
 * react-native-web's `Alert.alert` is a no-op, so on web every confirmation
 * silently did nothing. On native this delegates to `Alert.alert` unchanged.
 *
 * Web mapping (button shapes used in the app: none, one, or cancel + action):
 * - no buttons            -> `window.alert(title\n\nmessage)`
 * - exactly one button    -> `window.alert`, then that button's `onPress`
 * - only cancel buttons   -> `window.alert`, then the first one's `onPress`
 * - cancel + 1..n actions -> `window.confirm`; OK runs the FIRST non-cancel
 *   button's `onPress`, Cancel runs the cancel button's `onPress` (if any).
 *   A browser confirm only has two outcomes, so extra actions are not
 *   reachable on web — avoid 3+ distinct actions in a single call.
 */
export interface DialogButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: "default" | "cancel" | "destructive";
}

export interface DialogEnv {
  isWeb: boolean;
  confirm: (message: string) => boolean;
  alert: (message: string) => void;
  nativeAlert: (title: string, message?: string, buttons?: DialogButton[]) => void;
}

export function presentAlert(
  title: string,
  message: string | undefined,
  buttons: DialogButton[] | undefined,
  env: DialogEnv,
): void {
  if (!env.isWeb) {
    env.nativeAlert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons ?? [];
  const cancel = list.find((b) => b.style === "cancel");
  const actions = list.filter((b) => b.style !== "cancel");

  if (list.length <= 1 || actions.length === 0) {
    env.alert(text);
    (list[0] ?? undefined)?.onPress?.();
    return;
  }

  if (env.confirm(text)) {
    actions[0].onPress?.();
  } else {
    cancel?.onPress?.();
  }
}
