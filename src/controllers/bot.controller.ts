import TelegramBot from 'node-telegram-bot-api';
import bot from '../services/bot.service';
import prisma from '../database/prisma';
import redis from '../services/redis.service';
import { teacherAgent } from '../agents/teacher.agent';
import { smmAgent } from '../agents/smm.agent';
import { sheetsService } from '../services/sheets.service';
import { startKeyboard, teacherKeyboard, studentKeyboard, attendanceKeyboard } from '../utils/keyboards';
import { CoinsController } from './coins.controller';

export class BotController {
    static async handleMessage(msg: TelegramBot.Message) {
        const chatId = msg.chat.id;
        const text = msg.text || msg.caption || '';
        const userId = msg.from?.id;

        console.log(`📩 Xabar keldi: [${msg.chat.type}] chatId=${chatId} from=${userId} text="${text}" media=${msg.photo ? 'photo' : msg.voice ? 'voice' : msg.document ? 'doc' : 'none'}`);

        if (!userId) return;

        // 0. Handle Multimodal Input (Photos, Voice, etc.)
        if (msg.photo || msg.voice || msg.document) {
            return BotController.handleMultimodalSubmission(msg);
        }

        // 0. Hashtag-based coin/attendance commands (group messages)
        if (text.startsWith('#')) {
            const handled = await CoinsController.handleHashtagMessage(msg);
            if (handled) return;
        }

        const isPrivate = msg.chat.type === 'private';

        // 0.1 Clear keyboards in groups for specific menu buttons
        const menuButtons = [
            "👨‍🏫 O'qituvchi", "👨‍🎓 O'quvchi", "🤖 AI Boshqaruv",
            "📊 Statistika", "➕ Guruh yaratish", "📝 Vazifa berish",
            "📥 Vazifa yuborish", "👤 Profil", "🏠 Asosiy menyu"
        ];

        if (!isPrivate && (menuButtons.includes(text) || text === '/start')) {
            return bot.sendMessage(chatId, "Asosiy menyu faqat bot bilan shaxsiy yozishmada ishlaydi. Guruhda faqat # buyruqlarini ishlating.", {
                reply_markup: { remove_keyboard: true }
            });
        }

        // 1. Registry
        await BotController.ensureUser(msg);
        await BotController.ensureGroup(msg);

        const state = await redis.get(`user_state:${userId}`);

        // 2. Global Escape Hatch & Commands
        if (text === '/start' || text === '🏠 Asosiy menyu') {
            await redis.del(`user_state:${userId}`);
            await redis.del(`hw_group:${userId}`);
            await redis.del(`group_name:${userId}`);

            const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
            const keyboard = user?.role === 'ADMIN' ? teacherKeyboard : (user ? studentKeyboard : startKeyboard);
            return bot.sendMessage(chatId, "Kerakli panelni tanlang:", { reply_markup: keyboard });
        }

        if (state === 'WAITING_PASSWORD') {
            return BotController.handlePassword(msg);
        }

        // 3. AI Management Flow
        if (state === 'WAITING_AI_CMD') {
            return BotController.handleAiCommand(msg);
        }

        if (state === 'WAITING_GROUP_NAME') {
            await redis.set(`group_name:${userId}`, text);
            await redis.set(`user_state:${userId}`, 'WAITING_GROUP_DESC');
            return bot.sendMessage(chatId, "Guruh tavsifini kiriting (vazifalari, maqsadi qanaqa?):");
        }

        if (state === 'WAITING_GROUP_DESC') {
            const name = await redis.get(`group_name:${userId}`);
            if (name) {
                await prisma.group.create({ data: { name, description: text } });
                await bot.sendMessage(chatId, `✅ Guruh yaratildi: ${name}`, {
                    reply_markup: isPrivate ? teacherKeyboard : { remove_keyboard: true }
                });
            }
            await redis.del(`group_name:${userId}`);
            await redis.del(`user_state:${userId}`);
            return;
        }

        if (state === 'WAITING_HW_DESC') {
            return BotController.handleHwCreation(msg);
        }

        if (state === 'WAITING_ATTENDANCE_NAME') {
            await redis.del(`user_state:${userId}`);
            const sheetId = await BotController.getGroupSheetId(chatId);
            if (!sheetId) return bot.sendMessage(chatId, "Kechirasiz, guruh jadvali topilmadi. Admin bilan bog'laning.");

            await bot.sendMessage(chatId, "⏳ Davomat belgilanmoqda...");
            const result = await sheetsService.markAttendance(sheetId, text);
            if (result) {
                const totalCoins = await sheetsService.getTotalCoins(sheetId, text);
                const rank = await sheetsService.getStudentRank(sheetId, text);
                return bot.sendMessage(chatId, `✅ Barakalla, ${text}! Davomat belgilandi.\n💰 +5 coin! Jami: ${totalCoins}\n🏆 Reyting: ${rank}-o'rin`, { reply_markup: studentKeyboard });
            } else {
                return bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.", { reply_markup: studentKeyboard });
            }
        }

        // Buttons
        if (text === "👨‍🏫 O'qituvchi") {
            const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
            if (user?.role === 'ADMIN') {
                return bot.sendMessage(chatId, "Xush kelibsiz, Ustoz!", {
                    reply_markup: isPrivate ? teacherKeyboard : { remove_keyboard: true }
                });
            }
            await redis.set(`user_state:${userId}`, 'WAITING_PASSWORD');
            return bot.sendMessage(chatId, "O'qituvchi paneliga kirish uchun maxfiy kodni kiriting:");
        }

        if (text === "👨‍🎓 O'quvchi") {
            return bot.sendMessage(chatId, "O'quvchi paneli faollashtirildi. Dars qilishni unutmang!", {
                reply_markup: isPrivate ? studentKeyboard : { remove_keyboard: true }
            });
        }

        if (text === "🤖 AI Boshqaruv") {
            await redis.set(`user_state:${userId}`, 'WAITING_AI_CMD');
            return bot.sendMessage(chatId, "🤖 AI paneli ochiq.\nBuyruq yozing: Post tayyorlash, o'quvchilarni tahlil qilish kabilar...");
        }

        if (text === "➕ Guruh yaratish") {
            await redis.set(`user_state:${userId}`, 'WAITING_GROUP_NAME');
            return bot.sendMessage(chatId, "Yangi guruh nomini kiriting:");
        }

        if (text === "📝 Vazifa berish") {
            const groups = await prisma.group.findMany();
            if (groups.length === 0) return bot.sendMessage(chatId, "Hali guruhlar yo'q! Oldin guruh yarating.");
            let keyboard = groups.map((g: any) => [{ text: `/set_group ${g.id} ${g.name}` }]);
            keyboard.push([{ text: "🏠 Asosiy menyu" }]);
            return bot.sendMessage(chatId, "Qaysi guruhga vazifa beramiz?", { reply_markup: { keyboard, resize_keyboard: true } });
        }

        if (text.startsWith("/set_group")) {
            const parts = text.split(" ");
            const groupId = parts[1];
            await redis.set(`user_state:${userId}`, 'WAITING_HW_DESC');
            await redis.set(`hw_group:${userId}`, groupId);
            return bot.sendMessage(chatId, "Vazifani quyidagi formatda yozing:\n\n#HW <raqam>\nTopshiriq 1]\nTopshiriq 2]\nDeadline HH:MM\n\nMisol:\n#HW15\n1] Ingliz tilida 5 ta gap..\nDeadline 20:00", {
                reply_markup: isPrivate ? teacherKeyboard : { remove_keyboard: true }
            });
        }

        if (text === "📊 Statistika") {
            return BotController.showProgress(msg);
        }

        if (text === "📅 Davomat") {
            await redis.set(`user_state:${userId}`, 'WAITING_ATTENDANCE_NAME');
            return bot.sendMessage(chatId, "Ism va familiyangizni yuboring:", { reply_markup: attendanceKeyboard });
        }

        if (text === "✍️ Vazifa topshirish") {
            return bot.sendMessage(chatId, "📥 Yaxshi, vazifangiz matnini yoki rasmini/audiosini shu yerga tashlang. AI tahlil qilib, coin hisoblaydi!", { reply_markup: studentKeyboard });
        }

        if (text === "/ai feedback" || text.toLowerCase() === "feedback") {
            const lastSubHw = await redis.get(`last_hw:${userId}`);
            if (lastSubHw) {
                const evaluationStr = await redis.get(`eval_${userId}_${lastSubHw}`);
                if (evaluationStr) {
                    return bot.sendMessage(chatId, `🤖 AI Feedback:\n\n${evaluationStr}`);
                }
            }
            return bot.sendMessage(chatId, "Feedback uchun oxirgi vazifa topilmadi.");
        }

        if (text.startsWith('/')) {
            return BotController.handleCommand(msg);
        }

        // Detect Submissions (Group-specific)
        if (!isPrivate) {
            const group = await prisma.group.findFirst({ where: { telegramId: chatId.toString() } });
            if (group) {
                const activeHwId = await redis.get(`active_hw_id:${group.id}`);
                if (activeHwId && BotController.isSubmission(text)) {
                    return BotController.handleSubmission(msg, activeHwId);
                }
            }
        }

        // 7. Question Handling (Safety check first)
        if (BotController.isQuestion(text)) {
            return BotController.handleQuestion(msg);
        }
    }

    private static async safeSendMessage(chatId: number, text: string, options: any = {}) {
        try {
            return await bot.sendMessage(chatId, text, options);
        } catch (error: any) {
            // Check if it's a markdown parsing error
            if (error.response?.body?.description?.includes("can't parse entities")) {
                console.warn("Markdown parsing failed, falling back to plain text.");
                // Remove parse_mode and try again
                const { parse_mode, ...plainOptions } = options;
                return await bot.sendMessage(chatId, text, plainOptions);
            }
            throw error;
        }
    }


    private static async ensureGroup(msg: TelegramBot.Message) {
        if (msg.chat.type === 'private') return;
        const chatId = msg.chat.id.toString();

        const existing = await prisma.group.findFirst({ where: { telegramId: chatId } });
        if (existing) {
            await prisma.group.update({
                where: { id: existing.id },
                data: { name: msg.chat.title || 'Guruh' }
            });
        } else {
            await prisma.group.create({
                data: {
                    telegramId: chatId,
                    name: msg.chat.title || 'Guruh',
                    description: 'Guruh',
                    googleSheetId: process.env.GOOGLE_SHEETS_ID
                }
            });
        }
    }

    private static async ensureUser(msg: TelegramBot.Message) {
        const user = msg.from;
        if (!user) return;

        await prisma.user.upsert({
            where: { telegramId: BigInt(user.id) },
            update: { lastActivity: new Date(), username: user.username },
            create: {
                telegramId: BigInt(user.id),
                username: user.username,
                fullName: `${user.first_name} ${user.last_name || ''}`.trim(),
                role: 'STUDENT',
            },
        });
    }

    private static async handlePassword(msg: TelegramBot.Message) {
        const userId = msg.from!.id;
        const chatId = msg.chat.id;
        if (msg.text === 'SANATBEK_PRO' || msg.text === 'admin') {
            await prisma.user.update({
                where: { telegramId: BigInt(userId) },
                data: { role: 'ADMIN' }
            });
            await redis.del(`user_state:${userId}`);
            const isPrivate = msg.chat.type === 'private';
            return bot.sendMessage(chatId, "Kirish muvaffaqiyatli! O'qituvchi paneli ochildi.", {
                reply_markup: isPrivate ? teacherKeyboard : { remove_keyboard: true }
            });
        } else {
            return bot.sendMessage(chatId, "Xato kod! Qaytadan urinib ko'ring yoki /start bosing.");
        }
    }

    private static async handleAiCommand(msg: TelegramBot.Message) {
        const userId = msg.from!.id;
        const chatId = msg.chat.id;
        const command = msg.text || '';
        const lowerCmd = command.toLowerCase();

        if (lowerCmd.includes('quiz') || lowerCmd.includes('test') || lowerCmd.includes("so'rovnoma")) {
            return BotController.handleAiQuiz(chatId, command);
        }

        await bot.sendMessage(chatId, "🤖 AI o'ylamoqda...");

        if (lowerCmd.includes('post') || lowerCmd.includes('xabar') || lowerCmd.includes('kanal')) {
            const customPost = await smmAgent.generateManualPost(command);
            return bot.sendMessage(chatId, customPost, { parse_mode: 'Markdown' });
        }

        if (lowerCmd.includes('tahlil') || lowerCmd.includes('analiz') || lowerCmd.includes("o'quvchi")) {
            return BotController.handleAiStudentAnalysis(chatId);
        }

        if (lowerCmd.includes('statistika') || lowerCmd.includes('natija')) {
            return BotController.handleAiStatsAnalysis(chatId);
        }

        // Fallback to conversational AI if the action wasn't matched strictly.
        const ans = await teacherAgent.generateContent(`O'qituvchining yuborgan shaxsiy gapiga yoki buyrug'iga toza o'zbek tilida mos, mehribon va aqlli yordamchi sifatida javob ber. Savol yoki gap: "${command}"`);
        await bot.sendMessage(chatId, `🤖: ${ans}`);
    }

    private static async handleCommand(msg: TelegramBot.Message) {
        const text = msg.text || '';
        const chatId = msg.chat.id;

        if (text === '/start') {
            await bot.sendMessage(chatId, "Assalomu alaykum! Men sizning AI Teacher Assistant botingizman.");
        }

        // Admin commands check
        const user = await prisma.user.findUnique({ where: { telegramId: BigInt(msg.from!.id) } });
        if (user?.role !== 'ADMIN') {
            if (text === '/progress') {
                return BotController.showProgress(msg);
            }
            return;
        }

        if (text.startsWith('/link_sheet')) {
            if (msg.chat.type === 'private') {
                return bot.sendMessage(chatId, "Ushbu buyruqni guruh ichida yozishingiz kerak!");
            }
            const sheetId = text.replace('/link_sheet', '').trim();
            if (!sheetId) return bot.sendMessage(chatId, "Google Sheet ID sini kiriting.\nMisol: `/link_sheet 1ehQX...`", { parse_mode: 'Markdown' });

            const existing = await prisma.group.findFirst({ where: { telegramId: chatId.toString() } });
            if (existing) {
                await prisma.group.update({
                    where: { id: existing.id },
                    data: { googleSheetId: sheetId, name: msg.chat.title || 'Guruh' }
                });
            } else {
                await prisma.group.create({
                    data: { telegramId: chatId.toString(), googleSheetId: sheetId, name: msg.chat.title || 'Guruh', description: 'Guruh' }
                });
            }
            return bot.sendMessage(chatId, `✅ Ushbu guruh uchun alohida Google Sheet bog'landi!\n\nID: \`${sheetId}\``, { parse_mode: 'Markdown' });
        }

        if (text.startsWith('/admin_post')) {
            const topic = text.replace('/admin_post', '').trim();
            const post = await smmAgent.generateManualPost(topic || 'Grammar tip');
            // Assume channel ID is set in ENV
            const channelId = process.env.CHANNEL_ID;
            if (channelId) await bot.sendMessage(channelId, post);
            else await bot.sendMessage(chatId, "Channel ID sozlanmagan.");
        }

        if (text === '/students') {
            const students = await prisma.user.findMany({ where: { role: 'STUDENT' } });
            let response = "O'quvchilar ro'yxati:\n";
            students.forEach((s: any) => response += `- ${s.fullName} (@${s.username || 'n/a'})\n`);
            await bot.sendMessage(chatId, response);
        }

        if (text.startsWith('/ai')) {
            const command = text.replace('/ai', '').trim();
            if (!command) return bot.sendMessage(chatId, "AI uchun buyruqni kiriting. Masalan: /ai o'quvchilarni tahlil qil");

            const interpretation = await teacherAgent.interpretCommand(command);

            switch (interpretation.action) {
                case 'STUDENT_ANALYSIS':
                    return BotController.handleAiStudentAnalysis(chatId);
                case 'POST_PLAN':
                    return BotController.handleAiPostPlanning(chatId);
                case 'STATS':
                    return BotController.handleAiStatsAnalysis(chatId);
                default:
                    await bot.sendMessage(chatId, `🤖 AI: ${interpretation.suggestion}`);
            }
        }
    }

    private static async handleAiStudentAnalysis(chatId: number) {
        const students = await prisma.user.findMany();
        const active = students.filter((s: any) => s.totalHomeworks > 0);
        const passive = students.filter((s: any) => s.totalHomeworks === 0);

        let report = "📊 **O'quvchilar tahlili (AI):**\n\n";
        report += `✅ Faol (vazifa topshirgan): ${active.length} ta\n`;
        report += `❌ Noaktiv: ${passive.length} ta\n\n`;

        if (passive.length > 0) {
            report += "Tavsiya: Noaktiv o'quvchilarga eslatma yuborish kerak.";
        }

        await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    }

    private static async handleAiPostPlanning(chatId: number) {
        const posts = await prisma.channelPost.findMany({ take: 5, orderBy: { postedAt: 'desc' } });
        const suggestion = await smmAgent.generateDailyPost(posts.map((p: any) => p.content), {});

        await bot.sendMessage(chatId, `📝 **AI tavsiya qilgan yangi post rejasi:**\n\n${suggestion}`, { parse_mode: 'Markdown' });
    }

    private static async handleAiQuiz(chatId: number, topic: string) {
        await bot.sendMessage(chatId, "⏳ AI test tuzmoqda, ozgina kuting...");
        const quiz = await smmAgent.generateQuiz(topic);
        if (!quiz || !quiz.options || quiz.options.length < 2) {
            return bot.sendMessage(chatId, "❌ Kechirasiz, quiz yarata olmadim. Boshqa mavzu berib ko'ring.");
        }
        await bot.sendPoll(chatId, quiz.question, quiz.options, { is_anonymous: false });
    }

    private static async handleAiStatsAnalysis(chatId: number) {
        const submissions = await prisma.submission.findMany();
        const avgScore = submissions.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0) / (submissions.length || 1);

        let report = "📈 **Umumiy statistika tahlili:**\n\n";
        report += `🔹 Jami topshiriqlar: ${submissions.length} ta\n`;
        report += `🔹 O'rtacha o'zlashtirish: ${avgScore.toFixed(1)}%\n`;
        report += `\nAI xulosasi: O'quvchilar darslarni ${avgScore > 70 ? 'yaxshi' : 'o\'rtacha'} o'zlashtirmoqda.`;

        await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });
    }

    private static async handleHwCreation(msg: TelegramBot.Message) {
        const text = msg.text || '';
        const match = text.match(/#HW(\d+)\n([\s\S]+)\nDeadline\s+(\d{2}:\d{2})/i);
        const userId = msg.from!.id;

        if (!match) {
            return bot.sendMessage(msg.chat.id, "HW formati noto'g'ri. Misol:\n#HW12\n1] Matn...\nDeadline 22:00");
        }

        const hwNumber = parseInt(match[1]);
        const description = match[2].trim();
        const deadlineTime = match[3];

        const groupId = await redis.get(`hw_group:${userId}`);

        // Calculate deadline Date
        const deadline = new Date();
        const [hours, minutes] = deadlineTime.split(':').map(Number);
        deadline.setHours(hours, minutes, 0, 0);
        if (deadline < new Date()) deadline.setDate(deadline.getDate() + 1);

        const hw = await prisma.homework.upsert({
            where: { hwNumber },
            update: { description, deadline, isActive: true, groupId },
            create: { hwNumber, description, deadline, groupId },
        });

        await redis.set(`active_hw_id:${hw.groupId}`, hw.id);
        await redis.set(`hw_deadline:${hw.id}`, deadline.toISOString());

        await redis.del(`user_state:${userId}`);
        await redis.del(`hw_group:${userId}`);

        const isPrivate = msg.chat.type === 'private';
        await bot.sendMessage(msg.chat.id, `✅ Vazifa qabul qilindi: #HW${hwNumber} (${new Date(deadline).toLocaleString()})\n\nGuruh o'quvchilari endi topshirishi mumkin!`, {
            reply_markup: isPrivate ? teacherKeyboard : { remove_keyboard: true }
        });
    }

    private static isSubmission(text: string): boolean {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
        return sentences.length >= 3;
    }

    private static async handleSubmission(msg: TelegramBot.Message, hwId: string) {
        const userId = msg.from!.id;
        const dbUser = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
        if (!dbUser) return;

        // Check if already submitted
        const existing = await prisma.submission.findFirst({
            where: { userId: dbUser.id, hwId }
        });
        if (existing) return;

        const hw = await prisma.homework.findUnique({ where: { id: hwId } });
        if (!hw) return;

        const evaluation = await teacherAgent.evaluateHomework(msg.text!, hw.description);

        await prisma.submission.create({
            data: {
                userId: dbUser.id,
                hwId,
                text: msg.text!,
                score: evaluation.score,
                feedback: `${evaluation.correction}\n\nMaslahat: ${evaluation.advice}`,
            },
        });

        await prisma.user.update({
            where: { id: dbUser.id },
            data: { totalHomeworks: { increment: 1 } }
        });

        await redis.set(`last_hw:${msg.from!.id}`, hwId);
        await redis.set(`eval_${msg.from!.id}_${hwId}`, `Ball: ${evaluation.score}/100\n\n${evaluation.correction}\n\n💡 ${evaluation.advice}`);

        await bot.sendMessage(msg.chat.id, `✅ Vazifangiz qabul qilindi (#HW${hw.hwNumber})!\nAgar men yuborgan xatolar va ko'rsatmalar kerak bo'lsa, /ai feedback yoki shunchaki 'feedback' deb yozing.`, {
            reply_to_message_id: msg.message_id,
        });
    }

    private static isQuestion(text: string): boolean {
        // Ignore short words, links, etc.
        if (text.length < 10) return false;
        if (text.includes('http')) return false;
        return text.endsWith('?') || text.toLowerCase().includes('qanday') || text.toLowerCase().includes('nima');
    }

    private static async handleQuestion(msg: TelegramBot.Message) {
        const response = await teacherAgent.answerQuestion(msg.text!);
        await bot.sendMessage(msg.chat.id, response, { reply_to_message_id: msg.message_id });
    }

    private static async handleMultimodalSubmission(msg: TelegramBot.Message) {
        const userId = msg.from!.id;
        const chatId = msg.chat.id.toString();
        const feedbackModeName = await redis.get(`user_feedback_mode:${userId}`);

        let activeHwId: string | null = null;
        let groupRecord: any = null;

        if (msg.chat.type !== 'private') {
            groupRecord = await prisma.group.findFirst({ where: { telegramId: chatId } });
            if (groupRecord) {
                activeHwId = await redis.get(`active_hw_id:${groupRecord.id}`);
            }
        } else {
            // In PV, we use a global fallback for now or the student's primary group
            activeHwId = await redis.get('active_hw_id');
        }

        // Only proceed if it's either an active HW submission or student is in Feedback Mode
        if (!activeHwId && !feedbackModeName) return;

        const dbUser = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
        if (!dbUser) return;

        let taskDescription = 'General English practice/feedback';
        let hw: any = null;

        if (activeHwId && !feedbackModeName) {
            hw = await prisma.homework.findUnique({ where: { id: activeHwId } });
            if (hw) taskDescription = hw.description;
        }

        const isFeedbackMode = !!feedbackModeName;
        const processingMsg = isFeedbackMode
            ? "Ajoyib vazifangizni tekshirayapman, tez orada tahlil qilib beraman. 🧐"
            : "🧐 Vazifangizni qabul qildim. Senior Teacher tahlil qilmoqda, iltimos kuting...";

        await bot.sendMessage(msg.chat.id, processingMsg, { reply_to_message_id: msg.message_id });

        try {
            let fileId = '';
            let mimeType = '';

            if (msg.photo) {
                fileId = msg.photo[msg.photo.length - 1].file_id;
                mimeType = 'image/jpeg';
            } else if (msg.voice) {
                fileId = msg.voice.file_id;
                mimeType = msg.voice.mime_type || 'audio/ogg';
            } else if (msg.document) {
                fileId = msg.document.file_id;
                mimeType = msg.document.mime_type || 'application/octet-stream';
            }

            const fileLink = await bot.getFileLink(fileId);
            const response = await fetch(fileLink);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');

            const evaluation = await teacherAgent.evaluateHomework(msg.caption || '', taskDescription, [
                { data: base64, mimeType }
            ]);

            // If it was a HW, save it
            if (hw) {
                await prisma.submission.create({
                    data: {
                        userId: dbUser.id,
                        hwId: hw.id,
                        text: msg.caption || '[Media Submission]',
                        score: evaluation.score,
                        feedback: `${evaluation.correction}\n\nMaslahat: ${evaluation.advice}`,
                    },
                });

                await prisma.user.update({
                    where: { id: dbUser.id },
                    data: { totalHomeworks: { increment: 1 } }
                });
            }

            // Automatic Coin Awarding
            let coinMessage = '';
            if (evaluation.score >= 5) {
                const group = groupRecord || await prisma.group.findFirst({ where: { telegramId: msg.chat.id.toString() } });
                const sheetId = group?.googleSheetId || process.env.GOOGLE_SHEETS_ID;
                if (sheetId) {
                    const studentName = (isFeedbackMode && feedbackModeName !== 'unnamed')
                        ? feedbackModeName
                        : (dbUser.fullName || dbUser.username || 'Student');

                    await sheetsService.markTask(sheetId, studentName!, evaluation.score >= 8 ? "to'liq" : "yarim");
                    coinMessage = `\n\n💰 Sizga 5 ta coin berildi!`;
                }
            }

            const header = isFeedbackMode ? `🌟 **Professional Feedback** 🌟\n\n` : `✅ Media vazifa qabul qilindi!\n\n`;

            await BotController.safeSendMessage(msg.chat.id, `${header}${evaluation.correction}\n\n💡 Maslahat: ${evaluation.advice}${coinMessage}`, {
                reply_to_message_id: msg.message_id,
                parse_mode: 'Markdown'
            });

            // Clear feedback mode after one submission
            if (isFeedbackMode) {
                await redis.del(`user_feedback_mode:${userId}`);
            }

        } catch (error) {
            console.error('Error handling multimodal submission:', error);
            await bot.sendMessage(msg.chat.id, "❌ Faylni tahlil qilishda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
        }
    }

    private static async showProgress(msg: TelegramBot.Message) {
        const topStudents = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            orderBy: { totalHomeworks: 'desc' },
            take: 10
        });

        const activeCount = topStudents.filter((s: any) => s.totalHomeworks > 0).length;

        let text = `📊 **Statistika va Reyting:**\nFaol o'quvchilar: ${activeCount}/${topStudents.length}\n\n`;
        topStudents.forEach((s: any, i: number) => {
            const perc = (s.totalHomeworks > 0) ? 100 : 0; // simplistic completion %
            text += `${i + 1}. ${s.fullName} - ${s.totalHomeworks} ta vazifa (${perc}% bajargan)\n`;
        });

        await bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    }

    private static async getGroupSheetId(chatId: number): Promise<string | null> {
        const group = await prisma.group.findFirst({
            where: { telegramId: chatId.toString() }
        });
        return group?.googleSheetId || process.env.GOOGLE_SHEETS_ID || null;
    }
}
