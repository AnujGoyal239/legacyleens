// ============================================================
// LegacyLens — Groq LLM Service
// ============================================================

import Groq from 'groq-sdk';
import { logger } from '../trpc.js';
import type { SearchResult } from '../../types/index.js';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

const LLM_MODEL = 'llama-3.3-70b-versatile';
const MAX_CONTEXT_TOKENS = 8000;

/**
 * System prompt for code explanation
 */
const SYSTEM_PROMPT = `You are LegacyLens, an AI assistant specialized in explaining codebases. Your role is to help developers understand inherited or legacy code.

RULES:
1. Only answer based on the provided code context. If the context doesn't contain enough information, say so.
2. Always cite specific files and line references when mentioning code.
3. Explain the "why" behind design decisions, not just the "what".
4. Be concise but thorough. Use bullet points for clarity.
5. If you detect patterns, anti-patterns, or potential issues, mention them.
6. Format code references as: \`filename.ext\` (line X-Y)
7. Use markdown formatting for readability.

RESPONSE FORMAT:
- Start with a direct answer to the question
- Include relevant code snippets with file paths
- Explain the rationale/context
- End with related files or suggestions for further exploration`;

/**
 * Generate an answer to a code question using RAG context
 */
export async function generateAnswer(
  question: string,
  context: SearchResult[]
): Promise<{ text: string; tokenCount: number }> {
  // Build context string from search results
  const contextStr = context
    .map((result, i) => {
      return `--- File: ${result.filePath} (relevance: ${(result.score * 100).toFixed(0)}%) ---\n${result.content.slice(0, 2000)}`;
    })
    .join('\n\n');

  try {
    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `CODE CONTEXT:\n${contextStr}\n\nQUESTION: ${question}`,
        },
      ],
      temperature: 0.3, // Lower = more factual
      max_tokens: 1500,
      stream: false,
    });

    const answer = completion.choices[0]?.message?.content || 'Unable to generate an answer.';
    const tokenCount = completion.usage?.total_tokens || 0;

    logger.info({ tokenCount, model: LLM_MODEL }, 'LLM response generated');

    return { text: answer, tokenCount };
  } catch (error) {
    logger.error({ error }, 'LLM generation failed');
    throw new Error('Failed to generate answer from LLM');
  }
}

/**
 * Generate a streaming answer (returns async generator)
 */
export async function* generateAnswerStream(
  question: string,
  context: SearchResult[]
): AsyncGenerator<string> {
  const contextStr = context
    .map((result) => {
      return `--- File: ${result.filePath} ---\n${result.content.slice(0, 2000)}`;
    })
    .join('\n\n');

  try {
    const stream = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `CODE CONTEXT:\n${contextStr}\n\nQUESTION: ${question}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error) {
    logger.error({ error }, 'LLM streaming failed');
    yield 'Error: Failed to generate answer. Please try again.';
  }
}

/**
 * Generate a one-line summary of a git commit (for commit history / GitLens-style)
 */
export async function generateCommitSummary(message: string, filesChanged: string[]): Promise<string> {
  const filesStr = filesChanged.length ? filesChanged.slice(0, 15).join(', ') : 'no files';
  const prompt = `Summarize this git commit in one short sentence (max 15 words). Focus on what changed and why it matters.

Commit message: ${message}
Files changed: ${filesStr}${filesChanged.length > 15 ? ' (and more)' : ''}

Reply with only the summary sentence, no quotes.`;

  try {
    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: 'You are a commit summarizer. Reply with one short sentence only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 80,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || '';
    return summary.slice(0, 500);
  } catch (error) {
    logger.warn({ error }, 'Commit summary generation failed');
    return '';
  }
}

/**
 * Generate a short summary of a meeting transcript
 */
export async function generateMeetingSummary(transcript: string): Promise<string> {
  const prompt = `Summarize this meeting transcript in 2-4 concise paragraphs. Capture: main topics, key decisions, action items, and outcomes. Be clear and professional.

TRANSCRIPT:
${transcript.slice(0, 12000)}`;

  try {
    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: 'You are a meeting summarizer. Write clear, professional summaries.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    return completion.choices[0]?.message?.content?.trim() || 'No summary generated.';
  } catch (error) {
    logger.error({ error }, 'Meeting summary generation failed');
    return '';
  }
}

/**
 * Answer a question about a meeting (Meet Buddy) using transcript + summary + insights
 */
export async function answerMeetingQuestion(
  question: string,
  transcript: string,
  summary: string,
  insights: { decisions?: string[]; actionItems?: string[]; risks?: string[]; technicalDiscussions?: Array<{ topic: string; summary: string }> }
): Promise<string> {
  const insightsStr = [
    insights.decisions?.length ? `Decisions: ${insights.decisions.join('; ')}` : '',
    insights.actionItems?.length ? `Action items: ${insights.actionItems.join('; ')}` : '',
    insights.risks?.length ? `Risks: ${insights.risks.join('; ')}` : '',
    insights.technicalDiscussions?.length
      ? `Technical: ${insights.technicalDiscussions.map((t) => `${t.topic}: ${t.summary}`).join('; ')}`
      : '',
  ].filter(Boolean).join('\n');

  const context = `MEETING SUMMARY:\n${summary || 'N/A'}\n\nEXTRACTED INSIGHTS:\n${insightsStr || 'None'}\n\nFULL TRANSCRIPT (excerpt):\n${transcript.slice(0, 6000)}`;

  try {
    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are Meet Buddy, an AI assistant that was "in" the meeting. Answer questions about what was said, decided, or discussed using ONLY the meeting transcript and insights below. Be concise and cite the meeting (e.g. "In the meeting...", "The team decided..."). If the answer isn't in the transcript, say so.`,
        },
        {
          role: 'user',
          content: `${context}\n\nQUESTION: ${question}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    return completion.choices[0]?.message?.content?.trim() || "I couldn't find an answer to that in the meeting.";
  } catch (error) {
    logger.error({ error }, 'Meet Buddy answer failed');
    throw new Error('Failed to get answer from Meet Buddy');
  }
}

/**
 * Extract insights from meeting transcript
 */
export async function extractMeetingInsights(transcript: string): Promise<{
  decisions: string[];
  actionItems: string[];
  risks: string[];
  technicalDiscussions: Array<{ topic: string; summary: string }>;
}> {
  const prompt = `Analyze this meeting transcript and extract:
1. DECISIONS: Key decisions that were made
2. ACTION_ITEMS: Tasks or action items mentioned
3. RISKS: Any risks or concerns raised
4. TECHNICAL_DISCUSSIONS: Technical topics discussed with brief summaries

Respond in JSON format only. No explanations.

TRANSCRIPT:
${transcript.slice(0, 10000)}`;

  try {
    const completion = await groq.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: 'You are a meeting analysis tool. Always respond in valid JSON format.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      decisions: parsed.decisions || parsed.DECISIONS || [],
      actionItems: parsed.actionItems || parsed.ACTION_ITEMS || parsed.action_items || [],
      risks: parsed.risks || parsed.RISKS || [],
      technicalDiscussions: parsed.technicalDiscussions || parsed.TECHNICAL_DISCUSSIONS || parsed.technical_discussions || [],
    };
  } catch (error) {
    logger.error({ error }, 'Meeting insight extraction failed');
    return {
      decisions: [],
      actionItems: [],
      risks: [],
      technicalDiscussions: [],
    };
  }
}

/**
 * Transcribe audio using Groq Whisper
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string = 'audio.mp3'
): Promise<Array<{ text: string; start: number; end: number }>> {
  try {
    const uint8Array = new Uint8Array(audioBuffer);
    const blob = new Blob([uint8Array], { type: 'audio/mpeg' });
    const file = new File([blob], fileName, { type: 'audio/mpeg' });

    const response = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      language: 'en',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    // Parse segments from response
    const segments = (response as unknown as { segments?: Array<{ text: string; start: number; end: number }> }).segments || [];

    return segments.map((s) => ({
      text: s.text,
      start: s.start,
      end: s.end,
    }));
  } catch (error) {
    logger.error({ error }, 'Audio transcription failed');
    throw new Error('Failed to transcribe audio');
  }
}
