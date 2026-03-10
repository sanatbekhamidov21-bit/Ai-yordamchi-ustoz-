import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

export class GeminiAgent {
    private modelName: string;
    private systemInstruction: string;

    constructor(modelName: string = 'google/gemini-2.0-flash-001', systemInstruction?: string) {
        this.modelName = modelName;
        this.systemInstruction = systemInstruction || '';
    }

    async generateContent(prompt: string, mediaParts?: Array<{ data: string; mimeType: string }>): Promise<string> {
        try {
            const messages: any[] = [];

            if (this.systemInstruction) {
                messages.push({ role: 'system', content: this.systemInstruction });
            }

            if (!mediaParts || mediaParts.length === 0) {
                messages.push({ role: 'user', content: prompt });
            } else {
                const content: any[] = [{ type: 'text', text: prompt }];
                for (const part of mediaParts) {
                    content.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${part.mimeType};base64,${part.data}`
                        }
                    });
                }
                messages.push({ role: 'user', content });
            }

            const response = await fetch(OPENROUTER_BASE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://premium-english-bot.com',
                    'X-Title': 'Premium English Bot',
                },
                body: JSON.stringify({
                    model: this.modelName,
                    messages,
                }),
            });

            if (!response.ok) {
                const errorData = await response.text();
                console.error('OpenRouter API error:', response.status, errorData);
                throw new Error(`OpenRouter API error: ${response.status}`);
            }

            const data = await response.json() as any;
            return data.choices?.[0]?.message?.content || 'Javob olishda xatolik.';
        } catch (error) {
            console.error('AI error:', error);
            throw new Error('AI generation failed');
        }
    }

    async generateJson(prompt: string, mediaParts?: Array<{ data: string; mimeType: string }>): Promise<any> {
        try {
            const text = await this.generateContent(prompt + '\n\nIMPORTANT: Respond ONLY with a valid JSON object. Do not include any other text or explanation.', mediaParts);

            // Try to extract JSON from markdown or raw text
            let jsonStr = text.trim();

            // If it contains triple backticks, extract from inside
            const match = jsonStr.match(/\{[\s\S]*\}/);
            if (match) {
                jsonStr = match[0];
            }

            try {
                return JSON.parse(jsonStr);
            } catch (parseError) {
                // Second attempt: try to fix common AI JSON mistakes (like unescaped newlines in strings)
                // But generally, the regex above handles most cases.
                console.error('Initial JSON parse failed, text received:', text);
                throw parseError;
            }
        } catch (error) {
            console.error('AI JSON error:', error);
            return null;
        }
    }
}
