import { GeminiAgent } from './base.agent';

const SMM_PROMPT = `Sen O'zbekistondagi eng kuchli ingliz tili o'qituvchisisan. 
Sening vazifang Telegram kanal uchun qiziqarli va foydali postlar yaratish.
Postlar qisqa, tushunarli va o'zbek tilida bo'lishi kerak.
Har doim sodda ingliz tili va qisqa misollar ishlat.`;

export class SmmAgent extends GeminiAgent {
    constructor() {
        super('gemini-1.5-flash', SMM_PROMPT);
    }

    async generateDailyPost(lastPosts: string[], engagementData: any): Promise<string> {
        const prompt = `
Oxirgi 20 ta post mavzulari: ${lastPosts.join(', ')}
Analitika: ${JSON.stringify(engagementData)}

Yangi post yarat. Content turlari: grammar tip, vocabulary set, mini quiz, speaking task, motivation.
Post turini tanla va chiroyli formatda yoz.`;
        return this.generateContent(prompt);
    }

    async generateManualPost(topic: string): Promise<string> {
        const prompt = `Mavzu: "${topic}". Ushbu mavzuda professional Telegram post yoz.`;
        return this.generateContent(prompt);
    }

    async generateQuiz(topic: string): Promise<{
        question: string;
        options: string[];
    } | null> {
        const prompt = `Menga Telegram so'roqnomasi (Poll) uchun ma'lumot yaratib ber. Mavzu yuklangan matn: "${topic}".

Format FAQAT quyidagicha bo'lishi shart (hech qanday qo'shimcha yozuvsiz, faqat toza JSON, va options da maksimal 100 belgidan iborat 3-5 ta variant):
{
  "question": "Azizlar, qanday mavzuda dars o'tishimizni xohlaysiz?",
  "options": ["Grammatika", "Lug'at yodlash", "Speaking mashqlari", "IELTS strategiyasi"]
}`;
        const res = await this.generateJson(prompt);
        return res || null;
    }
}

export const smmAgent = new SmmAgent();
