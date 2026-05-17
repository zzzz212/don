// Lightweight browser device fingerprint — a best-effort signal for the
// anti-abuse cluster score, NOT a tracking identifier.
//
// It composes stable, non-PII browser/device traits into one string. The
// server hashes it (see hashFingerprint in anti-abuse.ts) and never
// stores the raw value. Two accounts created on the same machine/browser
// will usually produce the same hash; a determined abuser can change it,
// which is fine — it only needs to make casual farming visible.

/** Compose a fingerprint string. Call only in the browser. */
export function computeFingerprint(): string {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "";
  }
  try {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };
    const parts: (string | number)[] = [
      nav.userAgent ?? "",
      nav.language ?? "",
      (nav.languages ?? []).join(","),
      nav.platform ?? "",
      nav.hardwareConcurrency ?? 0,
      nav.deviceMemory ?? 0,
      nav.maxTouchPoints ?? 0,
      screen.width,
      screen.height,
      screen.colorDepth,
      window.devicePixelRatio ?? 1,
      new Date().getTimezoneOffset(),
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
      canvasSignature(),
    ];
    return parts.join("|");
  } catch {
    // A blocked canvas / privacy extension shouldn't break signup.
    return "";
  }
}

/** A tiny canvas-render hash — varies by GPU / font rasterisation. */
function canvasSignature(): string {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";
    canvas.width = 200;
    canvas.height = 40;
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#069";
    ctx.fillText("Яксо fingerprint ⚖", 2, 2);
    ctx.strokeStyle = "rgba(120,180,90,0.7)";
    ctx.strokeRect(4, 4, 120, 20);
    return canvas.toDataURL().slice(-48);
  } catch {
    return "no-canvas";
  }
}
