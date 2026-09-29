const POSITIVE = new Map<string, number>([
  ["amazing", 2], ["wonderful", 2], ["perfect", 2], ["loved", 2],
  ["excellent", 1.8], ["beautiful", 1.5], ["stunning", 1.8], ["fantastic", 1.8],
  ["great", 1.2], ["good", 1], ["nice", 0.9], ["lovely", 1.2], ["comfortable", 1.2],
  ["friendly", 1.4], ["helpful", 1.4], ["spotless", 1.6], ["clean", 1.2],
  ["delicious", 1.4], ["recommend", 1.5], ["gem", 1.3], ["magical", 1.8],
  ["smooth", 1], ["enjoyed", 1.2], ["best", 1.5], ["immaculate", 1.6],
]);

const NEGATIVE = new Map<string, number>([
  ["terrible", 2], ["awful", 2], ["horrible", 2], ["disgusting", 2.2],
  ["dirty", 1.8], ["filthy", 2.2], ["rude", 1.8], ["unfriendly", 1.4],
  ["broken", 1.4], ["smelly", 1.8], ["noisy", 1.3], ["loud", 1],
  ["disappointing", 1.6], ["overpriced", 1.4], ["scam", 2], ["worst", 2],
  ["bad", 1.2], ["poor", 1.3], ["slow", 0.8], ["cold", 0.7], ["dump", 1.8],
  ["nightmare", 2], ["useless", 1.6], ["ignore", 1.2], ["ignored", 1.4],
  ["waited", 0.9], ["cancelled", 1], ["ruined", 1.8], ["never again", 2.2],
]);

const STRONG_NEGATIVE_PHRASES = [
  "never again",
  "worst",
  "disgusting",
  "demanded a refund",
  "health hazard",
];

const NEGATORS = new Set(["not", "no", "never", "hardly", "barely", "wasn't", "isn't", "didn't"]);

export interface SentimentResult {
  score: number;
  flagged: boolean;
  label: "positive" | "mixed" | "negative";
}

export function analyzeSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase();
  const tokens = lower.replace(/[^a-z'\s]/g, " ").split(/\s+/).filter(Boolean);

  let pos = 0;
  let neg = 0;
  tokens.forEach((token, i) => {
    const negated = NEGATORS.has(tokens[i - 1] ?? "") || NEGATORS.has(tokens[i - 2] ?? "");
    const p = POSITIVE.get(token);
    const n = NEGATIVE.get(token);
    if (p) pos += negated ? -p : p;
    if (n) neg += negated ? -n : n;
  });

  const strongHit = STRONG_NEGATIVE_PHRASES.some((phrase) => lower.includes(phrase));

  const denom = Math.max(pos + neg, 3);
  let score = (pos - neg * 1.25) / denom;
  if (strongHit) score = Math.min(score, -0.55);
  score = Math.max(-1, Math.min(1, score));

  return {
    score: Math.round(score * 100) / 100,
    flagged: score <= -0.35,
    label: score > 0.15 ? "positive" : score >= -0.35 ? "mixed" : "negative",
  };
}
