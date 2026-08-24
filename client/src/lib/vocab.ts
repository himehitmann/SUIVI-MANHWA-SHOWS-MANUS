/**
 * Vocabulary learning data + pure gamification helpers.
 *
 * Every word is shown as script + romanization + translation, with an emoji as
 * a lightweight, dependency-free "image that matches the word", plus an example
 * sentence and a usage note surfaced on click. The dataset is original and
 * curated for accuracy; it is intentionally structured by category (Basics,
 * Numbers, Family, Food) so learners progress from beginner to fluent in small,
 * memorable steps. Levels/XP/streak logic is pure and unit-tested.
 */
export type LearnLang = "ko" | "ja" | "zh";

export interface LangMeta {
  code: LearnLang;
  label: string;
  flag: string;
  /** Name of the romanization system shown to the user. */
  romanization: string;
}

export const LEARN_LANGS: LangMeta[] = [
  { code: "ko", label: "한국어 · Korean", flag: "🇰🇷", romanization: "Romaja" },
  { code: "ja", label: "日本語 · Japanese", flag: "🇯🇵", romanization: "Rōmaji" },
  { code: "zh", label: "中文 · Chinese", flag: "🇨🇳", romanization: "Pinyin" },
];

export type CategoryId = "basics" | "numbers" | "family" | "food";

export interface Category {
  id: CategoryId;
  label: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { id: "basics", label: "Basics", emoji: "✨" },
  { id: "numbers", label: "Numbers", emoji: "🔢" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧" },
  { id: "food", label: "Food & drink", emoji: "🍜" },
];

export interface Word {
  id: string;
  lang: LearnLang;
  category: CategoryId;
  script: string; // characters (한글 / 漢字·かな / 汉字)
  reading: string; // romanization (romaja / rōmaji / pinyin)
  en: string;
  fr: string;
  emoji: string;
  note?: string; // usage / definition
  example?: string;
  exampleReading?: string;
  exampleEn?: string;
}

const W = (
  lang: LearnLang,
  category: CategoryId,
  script: string,
  reading: string,
  en: string,
  fr: string,
  emoji: string,
  note?: string,
  example?: string,
  exampleReading?: string,
  exampleEn?: string,
): Word => ({ id: `${lang}-${category}-${reading.replace(/[^a-z0-9]+/gi, "")}`, lang, category, script, reading, en, fr, emoji, note, example, exampleReading, exampleEn });

export const WORDS: Word[] = [
  // ---------------- Korean ----------------
  W("ko", "basics", "안녕하세요", "annyeonghaseyo", "Hello", "Bonjour", "👋", "Polite greeting used any time of day.", "안녕하세요, 만나서 반가워요.", "annyeonghaseyo, mannaseo bangawoyo.", "Hello, nice to meet you."),
  W("ko", "basics", "감사합니다", "gamsahamnida", "Thank you", "Merci", "🙏", "Formal 'thank you'.", "도와주셔서 감사합니다.", "dowajusyeoseo gamsahamnida.", "Thank you for helping."),
  W("ko", "basics", "네", "ne", "Yes", "Oui", "✅", "Also used as 'okay' / to acknowledge."),
  W("ko", "basics", "아니요", "aniyo", "No", "Non", "❌", "Polite 'no'."),
  W("ko", "basics", "물", "mul", "Water", "Eau", "💧", undefined, "물 주세요.", "mul juseyo.", "Water, please."),
  W("ko", "basics", "사랑", "sarang", "Love", "Amour", "❤️", "Noun; verb form is 사랑하다."),
  W("ko", "numbers", "일", "il", "One", "Un", "1️⃣", "Sino-Korean number, used for dates, money, phone numbers."),
  W("ko", "numbers", "이", "i", "Two", "Deux", "2️⃣"),
  W("ko", "numbers", "삼", "sam", "Three", "Trois", "3️⃣"),
  W("ko", "numbers", "사", "sa", "Four", "Quatre", "4️⃣"),
  W("ko", "numbers", "오", "o", "Five", "Cinq", "5️⃣"),
  W("ko", "numbers", "육", "yuk", "Six", "Six", "6️⃣"),
  W("ko", "family", "엄마", "eomma", "Mom", "Maman", "👩", "Casual; 어머니 is formal."),
  W("ko", "family", "아빠", "appa", "Dad", "Papa", "👨", "Casual; 아버지 is formal."),
  W("ko", "family", "가족", "gajok", "Family", "Famille", "👨‍👩‍👧"),
  W("ko", "family", "친구", "chingu", "Friend", "Ami", "🧑‍🤝‍🧑"),
  W("ko", "food", "밥", "bap", "Rice / meal", "Riz / repas", "🍚", "Also means 'a meal' in general."),
  W("ko", "food", "김치", "gimchi", "Kimchi", "Kimchi", "🥬"),
  W("ko", "food", "고기", "gogi", "Meat", "Viande", "🍖"),
  W("ko", "food", "커피", "keopi", "Coffee", "Café", "☕"),

  // ---------------- Japanese ----------------
  W("ja", "basics", "こんにちは", "konnichiwa", "Hello", "Bonjour", "👋", "Daytime greeting.", "こんにちは、田中です。", "konnichiwa, Tanaka desu.", "Hello, I'm Tanaka."),
  W("ja", "basics", "ありがとう", "arigatō", "Thank you", "Merci", "🙏", "Add ございます for politeness.", "ありがとうございます。", "arigatō gozaimasu.", "Thank you (polite)."),
  W("ja", "basics", "はい", "hai", "Yes", "Oui", "✅"),
  W("ja", "basics", "いいえ", "iie", "No", "Non", "❌"),
  W("ja", "basics", "水", "mizu", "Water", "Eau", "💧", undefined, "水をください。", "mizu o kudasai.", "Water, please."),
  W("ja", "basics", "愛", "ai", "Love", "Amour", "❤️", "Noun; 愛する = to love."),
  W("ja", "numbers", "一", "ichi", "One", "Un", "1️⃣"),
  W("ja", "numbers", "二", "ni", "Two", "Deux", "2️⃣"),
  W("ja", "numbers", "三", "san", "Three", "Trois", "3️⃣"),
  W("ja", "numbers", "四", "yon", "Four", "Quatre", "4️⃣", "Also read 'shi', but 'yon' is common."),
  W("ja", "numbers", "五", "go", "Five", "Cinq", "5️⃣"),
  W("ja", "numbers", "六", "roku", "Six", "Six", "6️⃣"),
  W("ja", "family", "お母さん", "okāsan", "Mother", "Mère", "👩", "Others' mother; 母 (haha) for one's own."),
  W("ja", "family", "お父さん", "otōsan", "Father", "Père", "👨", "Others' father; 父 (chichi) for one's own."),
  W("ja", "family", "家族", "kazoku", "Family", "Famille", "👨‍👩‍👧"),
  W("ja", "family", "友達", "tomodachi", "Friend", "Ami", "🧑‍🤝‍🧑"),
  W("ja", "food", "ご飯", "gohan", "Rice / meal", "Riz / repas", "🍚"),
  W("ja", "food", "寿司", "sushi", "Sushi", "Sushi", "🍣"),
  W("ja", "food", "肉", "niku", "Meat", "Viande", "🍖"),
  W("ja", "food", "コーヒー", "kōhī", "Coffee", "Café", "☕"),

  // ---------------- Chinese ----------------
  W("zh", "basics", "你好", "nǐ hǎo", "Hello", "Bonjour", "👋", "Literally 'you good'.", "你好，很高兴认识你。", "nǐ hǎo, hěn gāoxìng rènshi nǐ.", "Hello, nice to meet you."),
  W("zh", "basics", "谢谢", "xièxie", "Thank you", "Merci", "🙏", undefined, "谢谢你的帮助。", "xièxie nǐ de bāngzhù.", "Thank you for your help."),
  W("zh", "basics", "是", "shì", "Yes / to be", "Oui / être", "✅", "The verb 'to be' for nouns."),
  W("zh", "basics", "不", "bù", "No / not", "Non / ne… pas", "❌", "Negation particle; tone changes before 4th tone."),
  W("zh", "basics", "水", "shuǐ", "Water", "Eau", "💧", undefined, "我要水。", "wǒ yào shuǐ.", "I want water."),
  W("zh", "basics", "爱", "ài", "Love", "Amour", "❤️"),
  W("zh", "numbers", "一", "yī", "One", "Un", "1️⃣"),
  W("zh", "numbers", "二", "èr", "Two", "Deux", "2️⃣"),
  W("zh", "numbers", "三", "sān", "Three", "Trois", "3️⃣"),
  W("zh", "numbers", "四", "sì", "Four", "Quatre", "4️⃣"),
  W("zh", "numbers", "五", "wǔ", "Five", "Cinq", "5️⃣"),
  W("zh", "numbers", "六", "liù", "Six", "Six", "6️⃣"),
  W("zh", "family", "妈妈", "māma", "Mom", "Maman", "👩"),
  W("zh", "family", "爸爸", "bàba", "Dad", "Papa", "👨"),
  W("zh", "family", "家", "jiā", "Home / family", "Maison / famille", "🏠"),
  W("zh", "family", "朋友", "péngyou", "Friend", "Ami", "🧑‍🤝‍🧑"),
  W("zh", "food", "米饭", "mǐfàn", "Rice", "Riz", "🍚"),
  W("zh", "food", "茶", "chá", "Tea", "Thé", "🍵"),
  W("zh", "food", "肉", "ròu", "Meat", "Viande", "🍖"),
  W("zh", "food", "咖啡", "kāfēi", "Coffee", "Café", "☕"),
];

export function wordsFor(lang: LearnLang, category?: CategoryId): Word[] {
  return WORDS.filter((w) => w.lang === lang && (!category || w.category === category));
}

/** Mastery: 0 = unseen (absent), 1 = learning, 2 = known. */
export type Mastery = 1 | 2;

/** Level curve: each level costs a bit more, so progress feels earned but steady. */
export function levelInfo(xp: number): { level: number; into: number; needed: number; pct: number } {
  let level = 1;
  let rem = Math.max(0, Math.floor(xp));
  // cost to go from level L to L+1
  const cost = (l: number) => 40 + l * 20;
  while (rem >= cost(level)) {
    rem -= cost(level);
    level += 1;
  }
  const needed = cost(level);
  return { level, into: rem, needed, pct: Math.round((rem / needed) * 100) };
}

export const XP_LEARNING = 4;
export const XP_KNOWN = 10;
export const XP_REVIEW = 3;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Streak update given the previous streak and last-studied date (YYYY-MM-DD). */
export function nextStreak(prevStreak: number, last: string | null, today: string): number {
  if (last === today) return Math.max(prevStreak, 1);
  const y = new Date(today + "T00:00:00Z");
  y.setUTCDate(y.getUTCDate() - 1);
  if (last === ymd(y)) return prevStreak + 1;
  return 1;
}

export function todayStr(): string {
  return ymd(new Date());
}
