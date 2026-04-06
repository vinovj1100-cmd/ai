import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AppState, Personality } from "../types";

const apiKey = process.env.GEMINI_API_KEY;

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateAdaptiveResponse(
    prompt: string,
    history: any[],
    currentState: AppState
  ) {
    const systemInstruction = `
      You are Nexus AI, an adaptive intelligence. 
      Your current personality is: ${currentState.personality}.
      User context: ${JSON.stringify(currentState.userPreferences)}.
      
      You have the power to modify the application's interface and behavior.
      Available tools to enable/disable: ["vision", "image_gen", "search", "tts"].
      Current active tools: ${JSON.stringify(currentState.activeTools)}.
      
      If the user's request implies a change in theme, personality, tools, or user preferences (like name or interests), 
      include a JSON block at the end of your response in the following format:
      [ADAPT: {"theme": {...}, "personality": "...", "activeTools": [...], "userPreferences": {"name": "...", "interests": [...]}}]
      
      Example: If the user mentions they like "space exploration", you might suggest adding it to their interests.
      If they introduce themselves, suggest updating their name.
      
      Only include the [ADAPT] block if a change is actually needed.
      Current theme: ${JSON.stringify(currentState.theme)}.
    `;

    const response = await this.ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      }
    });

    return response;
  }

  async generateImage(prompt: string) {
    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  }

  async analyzeImage(imageBuffer: string, prompt: string) {
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: imageBuffer.split(',')[1], mimeType: "image/jpeg" } },
          { text: prompt }
        ]
      }
    });
    return response.text;
  }

  async textToSpeech(text: string, voice: 'Kore' | 'Puck' | 'Charon' = 'Kore') {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return `data:audio/wav;base64,${base64Audio}`;
    }
    return null;
  }
}
