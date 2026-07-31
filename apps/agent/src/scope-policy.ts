const explicitlyUnrelatedIntent =
  /\b(?:recipe|cook(?:ing)?|donkeys?|animal facts?|trivia|tell (?:me )?a joke|horoscope|poem|essay|homework|stock tip|sports score|celebrity gossip|politic(?:s|al)|video game|movie recommendation)\b/i;

const incidentLanguage =
  /\b(?:property|room|door|lock|key|water|leak|power|electric|smoke|fire|gas|heat|air|noise|broken|damage|safe|safety|access|guest|stay|booking|vendor|repair|maintenance|problem|issue|happened|working|stopped|started|still|now|tried|check|show|hear|smell|see)\b/i;

const continuationLanguage =
  /^(?:yes|no|okay|ok|sure|maybe|i did|i have|i can|i can't|it is|it's|there is|there's|that|this|now|still|just|about|around)\b/i;

const ignoredTokens = new Set([
  "about",
  "after",
  "again",
  "because",
  "could",
  "from",
  "have",
  "into",
  "just",
  "like",
  "please",
  "really",
  "that",
  "their",
  "there",
  "they",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
]);

function significantTokens(value: string): Set<string> {
  const tokens = value.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  return new Set(tokens.filter((token) => token.length >= 4 && !ignoredTokens.has(token)));
}

export type ScopeDecision =
  | { status: "relevant"; reason: "incident-language" | "goal-overlap" | "continuation" }
  | { status: "off-topic"; reason: "explicit-unrelated-intent" }
  | { status: "uncertain"; reason: "insufficient-signal" };

export function evaluateScope(userText: string, activeGoal?: string): ScopeDecision {
  const normalized = userText.trim();

  if (explicitlyUnrelatedIntent.test(normalized)) {
    return { status: "off-topic", reason: "explicit-unrelated-intent" };
  }

  if (incidentLanguage.test(normalized)) {
    return { status: "relevant", reason: "incident-language" };
  }

  if (activeGoal && continuationLanguage.test(normalized)) {
    return { status: "relevant", reason: "continuation" };
  }

  if (activeGoal) {
    const goalTokens = significantTokens(activeGoal);
    const turnTokens = significantTokens(normalized);
    if ([...turnTokens].some((token) => goalTokens.has(token))) {
      return { status: "relevant", reason: "goal-overlap" };
    }
  }

  return { status: "uncertain", reason: "insufficient-signal" };
}

export function buildScopeRedirect(): string {
  return "I can help with that another time, but I want to stay with the property issue until you’re safe and we know the next step. What changed since the last thing we tried?";
}
