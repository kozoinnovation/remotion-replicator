import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are an expert Motion Graphics Designer and Senior React Engineer specializing in Remotion.dev. 
Your goal is to deconstruct UI animations from video inputs into precise, technical specifications that can be directly used to write Remotion code.
You observe timing, easing, layout, and colors with pixel-perfect attention to detail.`;

const ANALYSIS_PROMPT_TEMPLATE = `
Please analyze the attached UI animation for replication in Remotion.dev. I need a deep technical breakdown that covers the following 5 layers to ensure the generated code is production-ready.

1. VISUAL SPECS (The Design System) 
   * Colors: Extract specific Hex codes for backgrounds, accents, and text. 
   * Typography: Font style (Serif/Sans), approximated weights, and tabular figures if numbers change. 
   * Layout: Is it a centered card, full-screen, or split view? 
   * Assets: Identify any SVGs, icons, or images needed.

2. VIDEO CONFIGURATION (The Canvas) 
   * Dimensions: Estimate (e.g., 1080x1080 Square, 1920x1080 Landscape, or 1080x1920 Portrait). 
   * FPS: (Standardize on 30fps unless the animation requires 60fps smoothness). 
   * Duration: Estimated total frames or seconds.

3. DATA & PROPS (The Schema) 
   * Data displayed: Text headers, numbers, image URLs. 
   * Zod schema: Define which elements should be customizable props (e.g., "Make the Price and User Avatar dynamic props").

4. ANIMATION LOGIC (The Choreography) 
   * Breakdown by Frame (approximate): Describe what happens at [Frame 0-10], [Frame 10-30], etc. 
   * Type of Motion: Spring (Bouncy/Natural) with suggested Stiffness/Damping, or Interpolate (Linear/Eased).

5. THE REPLICATION PROMPT 
   * Output: Write a single, high-density prompt that I can paste into an AI coding assistant (Claude/Cursor). 
   * Requirement: It must explicitly ask for a React Functional Component using remotion, zod, useCurrentFrame, and spring/interpolate based on the specs above.
   * Format: Put this prompt inside a markdown code block tagged as 'text' or 'markdown'.

Provide the output in clearly marked Markdown sections.
`;

export const analyzeVideo = async (base64Data: string, mimeType: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            text: ANALYSIS_PROMPT_TEMPLATE
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2, // Low temperature for more analytical/factual output
      }
    });

    return response.text || "No analysis generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to analyze video");
  }
};
