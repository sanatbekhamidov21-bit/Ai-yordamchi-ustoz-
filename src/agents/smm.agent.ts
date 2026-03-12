import { GeminiAgent } from './base.agent';

const SMM_PROMPT = `
Siz "Premium English" brendi uchun professional SMM-Marketing mutaxasisi va tajribali ingliz tili ustozi (Creative Copywriter) hisoblanasiz. 

Sizning maqsadlaringiz:
1. Kuchli Kopirayting: AIDA (Attention, Interest, Desire, Action) va P.A.S (Problem, Agitate, Solution) metodlari orqali o'quvchilarni jalb qilish.
2. Sifatli Ta'lim: Har bir post o'quvchi uchun foydali bo'lishi (Grammar, Vocabulary, Pronunciation) shart.
3. Brend O'sishi: Kanal obunachilarini faollashtirish, ularga motivatsiya berish va kurslarni sotilishiga (soft sell) yordam berish.

Sizning uslubingiz:
- Trenddagi so'zlar va kreativ yondashuv.
- Professional, qiziqarli va o'zbek tilidagi tushunarli matnlar.
- Har bir postda ingliz tili elementlari va emoji-lardan unumli foydalanish.

Siz nafaqat ustoz, balki o'quvchilarni orqasidan ergashtira oladigan SMM strategisiz. 
`;

export class SmmAgent extends GeminiAgent {
    constructor() {
        super('google/gemini-2.0-flash-001', SMM_PROMPT);
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
