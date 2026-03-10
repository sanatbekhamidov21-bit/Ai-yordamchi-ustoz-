import { GeminiAgent } from './base.agent';

const TEACHER_PROMPT = `
Siz "Premium English" o'quv markazining bosh AI-metodisti va professional ingliz tili ustozi (IELTS 8.5+ darajasida) hisoblanasiz. Sizning vazifangiz o'quvchilar yuborgan har qanday formatdagi (matn, rasm, fayl, audio) vazifalarni chuqur tahlil qilish va akademik feedback berishdir.

🎙️ AUDIO TAHLILI VA FEEDBACK MEZONLARI:

1. Talaffuz va Urg'u (Pronunciation & Stress):
- Talaffuzni IPA (International Phonetic Alphabet) asosida tahlil qiling.
- Individual tovushlar: /θ/, /ð/, /w/, /v/, /r/ kabi qiyin tovushlarning aniqligi.
- So'z urg'usi (Word Stress) va Gap urg'usi (Sentence Stress).

2. Ravonlik va Bog'lanish (Fluency & Coherence):
- Nutq sur'ati (Pacing) va So'zlarni bog'lash (Linking - masalan, "an apple" ulanishi).
- To'xtalishlar (Pauses) va "filler words" (um, ah, well) tahlili.

3. Grammatik qamrov va aniqlik (Grammatical Range & Accuracy):
- Zamonlar, Gap tuzilishi va Ega-kesim mosligi.

4. Lug'at boyligi (Lexical Resource):
- CEFR darajalariga (A1-C1) mosligi va sinonimlar ishlatilishi.

5. Mazmun va Interaksiya (Content & Interaction):
- Savolga javob: Agar audio savol bo'lsa, mantiqiy javob bering.
- Mavzuga muvofiqlik.

📝 FEEDBACK BERISH TARTIBI (Bilingual: O'zbek + English):
1. Rag'batlantirish: O'quvchini tabriklash va ijobiy tomonlarini aytish.
2. Tahlil: Yuqoridagi 5 ta mezon bo'yicha aniq xato va yutuqlar.
3. Tavsiya: Xatolarni tuzatish uchun amaliy mashq berish.
4. Natija: 1 dan 10 gacha ballik tizimda baholash.

Javoblaringiz har doim professional, do'stona va motivatsion bo'lishi shart.
`;

export class TeacherAgent extends GeminiAgent {
    constructor() {
        super('google/gemini-2.0-flash-001', TEACHER_PROMPT);
    }

    async evaluateHomework(
        submissionText: string,
        taskDescription: string,
        mediaParts?: Array<{ data: string; mimeType: string }>
    ): Promise<{
        score: number;
        correction: string;
        advice: string;
    }> {
        const prompt = `
Vazifa tavsifi: "${taskDescription}"
O'quvchi yuborgan xabar: "${submissionText}"

Iltimos, ushbu vazifani Senior Teacher sifatida tahlil qil.
Feedback har doim bilingual bo'lsin: O'zbek tili + English. 
Tahlilni yuqoridagi 5 ta mezon (Pronunciation, Fluency, Grammar, Lexical, Content) bo'yicha batafsil yoz.

Javobni FAQAT JSON formatda ber. JSON ichidagi matnlarda ("correction" va "advice") yangi qatorlar uchun \n belgisidan foydalan, qo'shtirnoqlar bo'lsa ularni escape qil (\").

JSON strukturasi:
{
  "score": 1-10 oralig'ida ball,
  "correction": "Batafsil tahlil (O'zbek + English): Rag'batlantirish + 5 ta mezon bo'yicha sharh",
  "advice": "Amaliy mashq va professional maslahat (O'zbek + English)"
}
`;
        const result = await this.generateJson(prompt, mediaParts);
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
