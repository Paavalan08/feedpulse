import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json", 
      }
    });

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