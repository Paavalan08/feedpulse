import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-001',
].filter((model): model is string => Boolean(model && model.trim()));

const generateContentWithFallback = async (contents: string, responseMimeType?: string) => {
  let lastError: unknown = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config: responseMimeType ? { responseMimeType } : undefined,
      });
    } catch (error: any) {
      lastError = error;
      if (error?.status !== 404) {
        throw error;
      }
      console.warn(`[Gemini] Model unavailable for generateContent: ${model}`);
    }
  }

  throw lastError ?? new Error('No compatible Gemini model available for generateContent');
};

interface DraftCoachParams {
  title: string;
  description: string;
  category: string;
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  latestUserMessage: string;
}

export const analyzeFeedbackWithAI = async (title: string, description: string) => {
  try {
    const prompt = `
      Analyse this product feedback. Return ONLY valid JSON with these fields: 
      "category" (must be: Bug, Feature Request, Improvement, or Other), 
      "sentiment" (must be: Positive, Neutral, or Negative), 
      "priority_score" (number from 1-10), 
      "summary" (a short 1-sentence summary), 
      "tags" (an array of 1-3 relevant string tags).
      
      Feedback Title: ${title}
      Feedback Description: ${description}
    `;

    const response = await generateContentWithFallback(prompt, 'application/json');

    const textResponse = response.text;
    
    if (!textResponse) {
      throw new Error("No response text from Gemini");
    }

    // Parse the JSON string returned by Gemini into a usable JavaScript object
    const parsedData = JSON.parse(textResponse);
    return parsedData;

  } catch (error) {
    console.error("Gemini AI Analysis Failed:", error);
    // Returning null allows us to handle the error gracefully without crashing the app
    return null; 
  }
};

export const coachFeedbackDraftWithAI = async ({
  title,
  description,
  category,
  chatHistory,
  latestUserMessage,
}: DraftCoachParams) => {
  try {
    const trimmedHistory = chatHistory.slice(-8);

    const prompt = `
      You are a product feedback writing assistant. Help users write clear, actionable product feedback.

      Return ONLY valid JSON with this exact shape:
      {
        "assistant_reply": "string",
        "quality_score": number,
        "quality_breakdown": {
          "clarity": number,
          "specificity": number,
          "impact": number,
          "actionability": number
        },
        "detected_category": "Bug | Feature Request | Improvement | Other",
        "suggested_title": "string",
        "suggested_description": "string",
        "improvements": ["string", "string", "string"],
        "next_questions": ["string", "string"]
      }

      Rules:
      - Scores must be integers between 1 and 100.
      - Keep assistant_reply concise (2-4 lines max).
      - suggested_description must stay under 500 characters.
      - Keep improvements to max 3 items.
      - Keep next_questions to max 2 items.

      Current draft:
      Title: ${title || '(empty)'}
      Description: ${description || '(empty)'}
      Category: ${category || '(empty)'}

      Recent conversation (JSON):
      ${JSON.stringify(trimmedHistory)}

      Latest user message:
      ${latestUserMessage}
    `;

    const response = await generateContentWithFallback(prompt, 'application/json');

    const textResponse = response.text;

    if (!textResponse) {
      throw new Error('No response text from Gemini draft coach');
    }

    return JSON.parse(textResponse);
  } catch (error) {
    console.error('Gemini Draft Coach Failed:', error);
    return null;
  }
};