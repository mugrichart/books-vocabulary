export interface OpenAIQuizResult {
  options: string[];
  explanation: string;
}

export async function generateQuizOptions(
  word: string,
  sentence: string
): Promise<OpenAIQuizResult> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    console.warn('OPENAI_API_KEY is not defined. Using mock quiz data.');
    return getMockQuiz(word);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an educational language assistant. Generate quiz options and contextual explanations for a vocabulary learning app. Respond ONLY with valid JSON.',
          },
          {
            role: 'user',
            content: `Given the target word/expression: "${word}"
And the context sentence: "${sentence}"

1. Generate exactly 4 multiple-choice options. One MUST be the exact word/expression: "${word}". The other 3 must be "distractors": words/expressions that are grammatically similar (same part of speech) and semantically related or plausible, but incorrect in this context to test the user's comprehension.
2. Generate a 2-fold explanation:
   - First: The meaning of the word/expression in general contexts.
   - Second: The specific meaning/nuance of the word/expression in the context of the provided sentence.

Return the result as a JSON object matching this schema:
{
  "options": ["option1", "option2", "option3", "option4"],
  "explanation": "General meaning: <general explanation here>\\n\\nIn context: <context explanation here>"
}

Note: Do not put any markdown formatting or extra text outside the JSON.`,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const resultText = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(resultText);

    if (Array.isArray(parsed.options) && parsed.options.length === 4 && parsed.explanation) {
      // Ensure the correct answer is indeed in the list
      if (!parsed.options.includes(word)) {
        parsed.options[0] = word;
      }
      // Shuffle options to randomize correct answer placement
      parsed.options.sort(() => Math.random() - 0.5);
      return {
        options: parsed.options,
        explanation: parsed.explanation,
      };
    }

    throw new Error('Invalid response structure from OpenAI');
  } catch (error) {
    console.error('Failed to generate quiz from OpenAI:', error);
    return getMockQuiz(word);
  }
}

function getMockQuiz(word: string): OpenAIQuizResult {
  const correct = word;
  const mockOptions = [correct, `${correct} (Alternative)`, `${correct} (Incorrect)`, `${correct} (Plausible)`];
  mockOptions.sort(() => Math.random() - 0.5);
  return {
    options: mockOptions,
    explanation: `General meaning: This is a placeholder general meaning for "${correct}".\n\nIn context: This is a placeholder contextual meaning for the expression.`,
  };
}
