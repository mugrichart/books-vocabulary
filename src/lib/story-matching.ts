function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removePunctuation(value: string) {
  return value.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function calculateSimilarity(expr: string, slice: string) {
  if (expr === slice) return 1;

  let matches = 0;
  const length = Math.max(expr.length, slice.length);
  if (length === 0) return 0;

  for (let index = 0; index < Math.min(expr.length, slice.length); index += 1) {
    if (expr[index] === slice[index]) {
      matches += 1;
    }
  }

  return matches / length;
}

function getPerfectScoreThreshold(charLength: number) {
  if (charLength <= 4) return 0.82;
  if (charLength <= 6) return 0.86;
  return 0.9;
}

function getMinimumScoreThreshold(charLength: number) {
  if (charLength <= 4) return 0.58;
  if (charLength <= 6) return 0.64;
  if (charLength <= 9) return 0.68;
  return 0.7;
}

function canonicalizeToken(token: string) {
  if (token.length <= 2) return token;

  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("ing") && token.length > 5) {
    const stem = token.slice(0, -3);
    return stem.endsWith(stem[stem.length - 1] ?? "") && stem.length > 3
      ? stem.slice(0, -1)
      : stem;
  }

  if (token.endsWith("ed") && token.length > 4) {
    return token.slice(0, -2);
  }

  if (token.endsWith("es") && token.length > 4) {
    return token.slice(0, -2);
  }

  if (token.endsWith("s") && token.length > 3) {
    return token.slice(0, -1);
  }

  return token;
}

function canonicalizePhraseTokens(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(canonicalizeToken);
}

export function contentUsesWord(content: string, word: string) {
  const normalizedExpression = removePunctuation(normalizeText(word));
  const normalizedContent = normalizeText(content);

  if (!normalizedExpression || !normalizedContent) return false;

  const expressionWords = canonicalizePhraseTokens(normalizedExpression);
  const contentWords = normalizedContent.split(/\s+/).filter(Boolean);
  if (expressionWords.length === 0 || contentWords.length === 0) return false;

  const windowSize = expressionWords.length;
  const joinedExpression = expressionWords.join(" ");
  const strictBoundary = joinedExpression.length <= 4;
  const perfectScoreThreshold = getPerfectScoreThreshold(joinedExpression.length);
  const minimumScoreThreshold = getMinimumScoreThreshold(joinedExpression.length);
  let bestScore = 0;

  for (let index = 0; index <= contentWords.length - windowSize; index += 1) {
    const rawSlice = contentWords.slice(index, index + windowSize).join(" ");
    const cleanedSlice = canonicalizePhraseTokens(removePunctuation(rawSlice)).join(" ");
    const score = calculateSimilarity(joinedExpression, cleanedSlice);

    if (score >= perfectScoreThreshold) {
      if (!strictBoundary) return true;
      const strictRegex = new RegExp(`\\b${escapeRegex(cleanedSlice)}\\b`, "i");
      return strictRegex.test(normalizedContent);
    }

    if (score > bestScore) {
      bestScore = score;
    }
  }

  return bestScore >= minimumScoreThreshold;
}
