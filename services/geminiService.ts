
import { GoogleGenAI, Modality } from "@google/genai";

export async function generateSpeech(text: string, voice: string): Promise<string> {
    // The API key is expected to be available in the environment variables.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!base64Audio) {
            throw new Error("No audio data was returned from the API.");
        }

        return base64Audio;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(`Failed to generate speech: ${errorMessage}`);
    }
}
