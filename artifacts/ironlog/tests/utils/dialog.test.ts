import { describe, expect, it, vi } from "vitest";

import { presentAlert, type DialogEnv } from "@/utils/dialog";

function makeEnv(overrides: Partial<DialogEnv> = {}) {
  const env = {
    isWeb: true,
    confirm: vi.fn(() => true),
    alert: vi.fn(),
    nativeAlert: vi.fn(),
    ...overrides,
  };
  return env as DialogEnv & {
    confirm: ReturnType<typeof vi.fn>;
    alert: ReturnType<typeof vi.fn>;
    nativeAlert: ReturnType<typeof vi.fn>;
  };
}

describe("presentAlert (native)", () => {
  it("delegates to Alert.alert unchanged", () => {
    const env = makeEnv({ isWeb: false });
    const buttons = [{ text: "OK" }];
    presentAlert("T", "M", buttons, env);
    expect(env.nativeAlert).toHaveBeenCalledWith("T", "M", buttons);
    expect(env.confirm).not.toHaveBeenCalled();
    expect(env.alert).not.toHaveBeenCalled();
  });
});

describe("presentAlert (web)", () => {
  it("no buttons: window.alert with title + message", () => {
    const env = makeEnv();
    presentAlert("Falta nombre", "Escribe un nombre.", undefined, env);
    expect(env.alert).toHaveBeenCalledWith("Falta nombre\n\nEscribe un nombre.");
    expect(env.confirm).not.toHaveBeenCalled();
  });

  it("title only: alert shows just the title", () => {
    const env = makeEnv();
    presentAlert("Listo", undefined, undefined, env);
    expect(env.alert).toHaveBeenCalledWith("Listo");
  });

  it("single button: alert then its onPress", () => {
    const env = makeEnv();
    const onPress = vi.fn();
    presentAlert("T", "M", [{ text: "OK", onPress }], env);
    expect(env.alert).toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("cancel + action, confirmed: runs the action only", () => {
    const env = makeEnv({ confirm: vi.fn(() => true) });
    const cancel = vi.fn();
    const action = vi.fn();
    presentAlert(
      "Eliminar",
      "¿Borrar?",
      [
        { text: "Cancelar", style: "cancel", onPress: cancel },
        { text: "Eliminar", style: "destructive", onPress: action },
      ],
      env,
    );
    expect(env.confirm).toHaveBeenCalledWith("Eliminar\n\n¿Borrar?");
    expect(action).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancel + action, dismissed: runs cancel only", () => {
    const env = makeEnv({ confirm: vi.fn(() => false) });
    const cancel = vi.fn();
    const action = vi.fn();
    presentAlert(
      "T",
      "M",
      [
        { text: "Cancelar", style: "cancel", onPress: cancel },
        { text: "Ok", onPress: action },
      ],
      env,
    );
    expect(action).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("works when cancel has no onPress and button order is reversed", () => {
    const env = makeEnv({ confirm: vi.fn(() => true) });
    const action = vi.fn();
    presentAlert("T", undefined, [{ text: "Si", onPress: action }, { text: "No", style: "cancel" }], env);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("3+ buttons: confirm maps OK to the first non-cancel button", () => {
    const env = makeEnv({ confirm: vi.fn(() => true) });
    const a = vi.fn();
    const b = vi.fn();
    presentAlert(
      "T",
      "M",
      [
        { text: "A", onPress: a },
        { text: "B", onPress: b },
        { text: "Cancelar", style: "cancel" },
      ],
      env,
    );
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("only a cancel button: alert, then its onPress", () => {
    const env = makeEnv();
    const cancel = vi.fn();
    presentAlert("T", "M", [{ text: "Cerrar", style: "cancel", onPress: cancel }], env);
    expect(env.alert).toHaveBeenCalled();
    expect(env.confirm).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
