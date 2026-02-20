import { GeminiAgent } from './base.agent';

const TEACHER_PROMPT = `Sen professional va mehribon o'zbek tili ingliz tili o'qituvchisisan. 
Sening vazifang o'quvchilar javoblarini tekshirish va ularga savollariga javob berishdir.
Har bir javobda qisqa va tushunarli bo'lishga harakat qil. Faqat bitta misol ber.`;

export class TeacherAgent extends GeminiAgent {
    constructor() {
        super('gemini-1.5-flash', TEACHER_PROMPT);
    }

    async evaluateHomework(submissionText: string, taskDescription: string): Promise<{
        score: number;
        correction: string;
        advice: string;
    }> {
        const prompt = `
Vazifa tavsifi: "${taskDescription}"
O'quvchi javobi: "${submissionText}"

Rubrika:
1. Grammar correctness
2. Task completion
3. Vocabulary usage
4. Clarity

Iltimos, javobni quyidagi JSON formatda ber:
{
  "score": 0-100 oralig'ida ball,
  "correction": "Xatolarni tuzatish va qisqa tushuntirish",
  "advice": "Yaxshilash uchun 1 ta maslahat"
}
`;
        const result = await this.generateJson(prompt);
        return result || {
            score: 0,
            correction: 'Tekshirishda xatolik yuz berdi.',
            advice: "Qaytadan urinib ko'ring."
        };
    }

    async answerQuestion(question: string): Promise<string> {
        const prompt = `O'quvchi savoli: "${question}"
    Iltimos, professional va do'stona tarzda, qisqa va londa javob ber. 1 ta misol qo'sh.`;
        return this.generateContent(prompt);
    }

    async interpretCommand(command: string): Promise<{
        action: 'POST_PLAN' | 'STUDENT_ANALYSIS' | 'STATS' | 'QUIZ' | 'UNKNOWN';
        suggestion: string;
        reasoning: string;
    }> {
        const prompt = `
O'qituvchi buyrug'i: "${command}"

Ushbu buyruqni tahlil qil va quyidagi amallardan birini tanla:
- STUDENT_ANALYSIS: O'quvchilar, guruhlar tekshirilganda, baholar yoki kimlar topshirgani so'ralsa.
- STATS: Statistika, natijalar haqida bo'lsa.
- QUIZ: So'rovnoma, quiz, test yoki poll so'ralsa (masalan, "so'rov yarat").
- POST_PLAN: Yuqoridagilarga tushmasa, lekin qayergadir (kanal/guruh) post yozish, xabar yuborish yoki yangi ma'lumot tuzib berish so'ralsa. Masalan: "kitob haqida xabar tayyorla", "guruhga motivatsiya yoz".
- UNKNOWN: Faqat umuman ma'noga ega bo'lmagan matn bo'lsa. Aks holda yuqoridagilardan birortasini tanla.
- UNKNOWN: Agar tushunarsiz bo'lsa.

Javobni FAQAT JSON formatda ber:
{
  "action": "ACTION_NAME",
  "suggestion": "O'qituvchiga beriladigan tavsiya yoki javob",
  "reasoning": "Nima uchun bu amal tanlangani haqida qisqa izoh"
}
`;
        const result = await this.generateJson(prompt);
        return result || { action: 'UNKNOWN', suggestion: 'Buyruqni tushuna olmadim.', reasoning: 'Xatolik' };
    }
}

export const teacherAgent = new TeacherAgent();
