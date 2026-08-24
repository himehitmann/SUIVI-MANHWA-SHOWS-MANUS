/**
 * Best-effort pronunciation via the Web Speech API (speechSynthesis).
 *
 * Fully optional and offline-friendly: if the browser has no matching voice it
 * silently does nothing. Voice availability varies by platform, so we pick the
 * closest voice for the target BCP-47 tag and fall back to just setting `lang`.
 */
import type { LearnLang } from "./vocab";

const BCP47: Record<LearnLang, string> = { ko: "ko-KR", ja: "ja-JP", zh: "zh-CN" };

/** Whether speech synthesis is usable in this environment. */
export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function pickVoice(target: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const lower = target.toLowerCase();
  const prefix = lower.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase() === lower) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
  );
}

/** Speak `text` in the given learning language. No-op if unsupported. */
export function speak(text: string, lang: LearnLang): void {
  if (!canSpeak() || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel(); // stop anything mid-utterance so taps feel responsive
    const u = new SpeechSynthesisUtterance(text);
    u.lang = BCP47[lang];
    const voice = pickVoice(u.lang);
    if (voice) u.voice = voice;
    u.rate = 0.9;
    synth.speak(u);
  } catch {
    /* speech is a nicety; never let it throw into the UI */
  }
}
