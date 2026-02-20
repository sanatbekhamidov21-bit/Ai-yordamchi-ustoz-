import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export class GeminiAgent {
    private model;

    constructor(modelName: string = 'gemini-1.5-flash', systemInstruction?: string) {
        this.model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction,
        });
    }

    async generateContent(prompt: string): Promise<string> {
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini error:', error);
            throw new Error('AI generation failed');
        }
    }

    async generateJson(prompt: string): Promise<any> {
        try {
            const result = await this.model.generateContent(prompt + ' Respond ONLY in valid JSON format.');
            const response = await result.response;
            const text = response.text();
            // Basic JSON extraction from markdown if AI wraps it
            const jsonStr = text.replace(/```json|```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('Gemini JSON error:', error);
            return null;
        }
    }
}
