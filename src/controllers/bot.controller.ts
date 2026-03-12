import TelegramBot from 'node-telegram-bot-api';
import bot from '../services/bot.service';
import redis from '../services/redis.service';
import { teacherAgent } from '../agents/teacher.agent';
import { smmAgent } from '../agents/smm.agent';
import { sheetsService } from '../services/sheets.service';
import { startKeyboard, teacherKeyboard, studentKeyboard, attendanceKeyboard, groupInlineKeyboard } from '../utils/keyboards';
import { CoinsController } from './coins.controller';

const MAIN_SHEET_ID = process.env.GOOGLE_SHEETS_ID || '';

export class BotController {
    static async handleMessage(msg: TelegramBot.Message) {
        const chatId = msg.chat.id;
        const text = msg.text || msg.caption || '';
        const userId = msg.from?.id;

        if (!userId) return;

        console.log(`📩 Xabar keldi: [${msg.chat.type}] chatId=${chatId} text="${text.substring(0, 30)}..."`);

        // 1. Ensure User & Group (in Google Sheets)
        await BotController.ensureUser(msg);
        if (msg.chat.type !== 'private') {
            await BotController.ensureGroup(msg);
        }

        // 2. Handle Submissions in Private Chat
        const isPrivate = msg.chat.type === 'private';
        if (isPrivate && (msg.photo || msg.voice || msg.document || (text && text.length > 20 && !text.startsWith('/')))) {
            return BotController.handlePrivateSubmission(msg);
        }

        // 3. Hashtag-based coin commands
        if (text.startsWith('#')) {
            const handled = await CoinsController.handleHashtagMessage(msg);
            if (handled) return;
        }

        const state = await redis.get(`user_state:${userId}`);

        // 4. Global Commands
        if (text === '/start' || text === '🏠 Asosiy menyu') {
            await redis.del(`user_state:${userId}`);

            const user = await sheetsService.getUser(MAIN_SHEET_ID, userId.toString());
            const keyboard = user?.role === 'ADMIN' ? teacherKeyboard : (user ? studentKeyboard : startKeyboard);

            if (!isPrivate) {
                return bot.sendMessage(chatId, "👋 Salom! Bot guruhda faol.", { reply_markup: groupInlineKeyboard });
            }
            return bot.sendMessage(chatId, "Kerakli panelni tanlang:", { reply_markup: keyboard });
        }

        if (state === 'WAITING_PASSWORD') {
            return BotController.handlePassword(msg);
        }

        // 5. Menu Buttons
        if (text === "👨‍🏫 O'qituvchi") {
            const user = await sheetsService.getUser(MAIN_SHEET_ID, userId.toString());
            if (user?.role === 'ADMIN') {
                return bot.sendMessage(chatId, "Xush kelibsiz, Ustoz!", { reply_markup: teacherKeyboard });
            }
            await redis.set(`user_state:${userId}`, 'WAITING_PASSWORD');
            return bot.sendMessage(chatId, "O'qituvchi paneliga kirish uchun maxfiy kodni kiriting:");
        }

        if (text === "👨‍🎓 O'quvchi") {
            return bot.sendMessage(chatId, "O'quvchi paneli faollashtirildi.", { reply_markup: studentKeyboard });
        }

        if (text === "📊 Statistika") {
            const coins = await sheetsService.getTotalCoins(MAIN_SHEET_ID, msg.from?.first_name || 'User');
            const rank = await sheetsService.getStudentRank(MAIN_SHEET_ID, msg.from?.first_name || 'User');
            return bot.sendMessage(chatId, `📊 **Sizning ko'rsatkichlaringiz:**\n\n💰 Jami coinlar: ${coins}\n🏆 Reyting: ${rank}-o'rin`, { parse_mode: 'Markdown' });
        }

        if (text === "📅 Davomat") {
            await redis.set(`user_state:${userId}`, 'WAITING_ATTENDANCE_NAME');
            return bot.sendMessage(chatId, "Ism va familiyangizni yuboring:", { reply_markup: attendanceKeyboard });
        }

        if (state === 'WAITING_ATTENDANCE_NAME') {
            await redis.del(`user_state:${userId}`);
            await bot.sendMessage(chatId, "⏳ Davomat belgilanmoqda...");
            const result = await sheetsService.markAttendance(MAIN_SHEET_ID, text);
            if (result) {
                return bot.sendMessage(chatId, `✅ Davomat belgilandi! +5 coin.`, { reply_markup: studentKeyboard });
            }
        }

        if (text === "👤 Profil") {
            const user = await sheetsService.getUser(MAIN_SHEET_ID, userId.toString());
            const coins = await sheetsService.getTotalCoins(MAIN_SHEET_ID, user?.fullName || 'User');
            const rank = await sheetsService.getStudentRank(MAIN_SHEET_ID, user?.fullName || 'User');

            let profile = `👤 **Profil:**\n\nIsm: ${user?.fullName}\nRol: ${user?.role}\n💰 Coinlar: ${coins}\n🏆 Reyting: ${rank}-o'rin`;
            return bot.sendMessage(chatId, profile, { parse_mode: 'Markdown' });
        }

        // 6. Question Analysis
        if (BotController.isQuestion(text)) {
            await bot.sendMessage(chatId, "🤔 Savolingizni tahlil qilyapman...");
            const answer = await teacherAgent.answerQuestion(text);
            return bot.sendMessage(chatId, answer, { reply_to_message_id: msg.message_id });
        }
    }

    private static async handlePrivateSubmission(msg: TelegramBot.Message) {
        const userId = msg.from!.id;
        const chatId = msg.chat.id;
        const userName = msg.from!.first_name;

        // 1. Give Coins (In Sheets)
        await sheetsService.markTask(MAIN_SHEET_ID, userName, "to'liq");

        // 2. Forward to Group
        const groupId = process.env.GROUP_ID;
        const topicId = process.env.VAZIFALAR_TOPIC_ID;

        if (groupId) {
            const caption = `📥 **Yangi vazifa topshirildi!**\n👤: ${userName}\n💰 Mukofot: +5 coin`;
            try {
                if (msg.photo) {
                    await bot.sendPhoto(groupId, msg.photo[msg.photo.length - 1].file_id, { caption, message_thread_id: topicId ? parseInt(topicId) : undefined });
                } else if (msg.voice) {
                    await bot.sendVoice(groupId, msg.voice.file_id, { caption, message_thread_id: topicId ? parseInt(topicId) : undefined });
                } else {
                    await bot.sendMessage(groupId, `${caption}\n\n📝:\n${msg.text || msg.caption}`, { message_thread_id: topicId ? parseInt(topicId) : undefined });
                }
            } catch (e) { console.error("Forward error:", e); }
        }

        // 3. Feedback Option
        let mediaData = msg.photo ? `photo:${msg.photo[msg.photo.length - 1].file_id}` : (msg.voice ? `voice:${msg.voice.file_id}` : '');
        await redis.set(`pending_fb_text:${userId}`, msg.text || msg.caption || '');
        await redis.set(`pending_fb_media:${userId}`, mediaData);

        return bot.sendMessage(chatId, `✅ **Vazifangiz qabul qilindi!**\n💰 +5 coin berildi.\n🤖 AI feedback berilsinmi?`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Ha", callback_data: `get_fb_${userId}` }],
                    [{ text: "❌ Yo'q", callback_data: "no_fb" }]
                ]
            }
        });
    }

    private static async handlePassword(msg: TelegramBot.Message) {
        const userId = msg.from!.id;
        if (msg.text === 'SANATBEK_PRO' || msg.text === 'admin') {
            await sheetsService.upsertUser(MAIN_SHEET_ID, {
                telegramId: userId.toString(),
                fullName: msg.from!.first_name,
                role: 'ADMIN'
            });
            await redis.del(`user_state:${userId}`);
            return bot.sendMessage(msg.chat.id, "Ustoz paneli ochildi!", { reply_markup: teacherKeyboard });
        }
        return bot.sendMessage(msg.chat.id, "Xato parol.");
    }

    static async handleCallback(query: TelegramBot.CallbackQuery) {
        const chatId = query.message?.chat.id;
        const userId = query.from.id;
        const data = query.data;

        if (!chatId || !data) return;

        if (data.startsWith('get_fb_')) {
            await bot.answerCallbackQuery(query.id, { text: "Tahlil qilinmoqda..." });
            const pText = await redis.get(`pending_fb_text:${userId}`) || '';
            const pMedia = await redis.get(`pending_fb_media:${userId}`) || '';

            let mediaParts: any[] = [];
            if (pMedia.startsWith('photo:')) {
                const fileLink = await bot.getFileLink(pMedia.split(':')[1]);
                const resp = await fetch(fileLink);
                mediaParts.push({ data: Buffer.from(await resp.arrayBuffer()).toString('base64'), mimeType: 'image/jpeg' });
            }

            const feedback = await teacherAgent.evaluateHomework(pText, "General Practice", mediaParts);
            await bot.sendMessage(chatId, `👨‍🏫 **Feedback:**\n\n${feedback.correction}\n\n💡 **Maslahat:** ${feedback.advice}`, { parse_mode: 'Markdown' });
            await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message!.message_id });
            return;
        }

        if (data === 'no_fb') {
            return bot.editMessageText("O'qishdan to'xtamang! 🚀", { chat_id: chatId, message_id: query.message!.message_id });
        }
    }

    private static isQuestion(text: string): boolean {
        return text.length > 10 && (text.endsWith('?') || text.toLowerCase().includes('qanday'));
    }

    private static async ensureUser(msg: TelegramBot.Message) {
        if (!msg.from) return;
        const existing = await sheetsService.getUser(MAIN_SHEET_ID, msg.from.id.toString());
        if (!existing) {
            await sheetsService.upsertUser(MAIN_SHEET_ID, {
                telegramId: msg.from.id.toString(),
                fullName: `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim(),
                username: msg.from.username,
                role: 'STUDENT'
            });
        }
    }

    private static async ensureGroup(msg: TelegramBot.Message) {
        if (msg.chat.type === 'private') return;
        await sheetsService.upsertGroup(MAIN_SHEET_ID, {
            chatId: msg.chat.id.toString(),
            name: msg.chat.title || 'Guruh',
            sheetId: MAIN_SHEET_ID
        });
    }
}
