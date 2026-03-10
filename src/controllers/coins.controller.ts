import TelegramBot from 'node-telegram-bot-api';
import bot from '../services/bot.service';
import { sheetsService } from '../services/sheets.service';
import prisma from '../database/prisma';
import redis from '../services/redis.service';

export class CoinsController {
    /**
     * Get sheet ID for a group from database
     */
    private static async getGroupSheetId(chatId: number): Promise<string | null> {
        const group = await prisma.group.findFirst({
            where: { telegramId: chatId.toString() }
        });
        return group?.googleSheetId || process.env.GOOGLE_SHEETS_ID || null;
    }

    /**
     * Handle messages starting with # in the group
     */
    static async handleHashtagMessage(msg: TelegramBot.Message): Promise<boolean> {
        const text = msg.text || '';
        const chatId = msg.chat.id;

        if (!text.startsWith('#')) return false;

        const sheetId = await CoinsController.getGroupSheetId(chatId);
        if (!sheetId) {
            console.error(`Sheet ID not found for group ${chatId}`);
            return false;
        }

        // Pattern 1: Task completion
        const taskMatch = text.match(/^#\s?(\S+)\s+vazifa\s+#\s?(to['']?liq|yarim)/i);
        if (taskMatch) {
            const name = taskMatch[1];
            const status = taskMatch[2].toLowerCase().includes('liq') ? "to'liq" : 'yarim';
            return CoinsController.processTask(chatId, sheetId, name, status, msg.message_id);
        }

        // Pattern 2: Attendance
        const attendanceMatch = text.match(/^#\s?(\S+)\s+darsga\s+qatnashdim/i);
        if (attendanceMatch) {
            const name = attendanceMatch[1];
            return CoinsController.processAttendance(chatId, sheetId, name, msg.message_id);
        }

        // Pattern 3: Feedback Request — #feedback [ism]
        const feedbackMatch = text.match(/^#feedback\s+(\S+)?/i);
        if (feedbackMatch) {
            const name = feedbackMatch[1] || '';
            await redis.set(`user_feedback_mode:${msg.from?.id}`, name || 'Teacher');
            await bot.sendMessage(chatId, "Ajoyib! Siz yuborgan audio / rasmga professional feedback beraman. Marhamat, vazifani jo'nating!", {
                reply_to_message_id: msg.message_id
            });
            return true;
        }

        return false;
    }

    private static async processTask(
        chatId: number,
        sheetId: string,
        name: string,
        status: "to'liq" | "yarim",
        messageId: number
    ): Promise<boolean> {
        try {
            const result = await sheetsService.markTask(sheetId, name, status);

            if (!result) {
                await bot.sendMessage(chatId, `❌ Xatolik yuz berdi. Google Sheets bilan bog'lanib bo'lmadi.`, {
                    reply_to_message_id: messageId,
                });
                return true;
            }

            const totalCoins = await sheetsService.getTotalCoins(sheetId, name);
            const rank = await sheetsService.getStudentRank(sheetId, name);

            const statusText = status === "to'liq" ? "to'liq bajarildi ✅" : "yarim bajarildi ⚠️";

            const message = [
                `🔥 Barakalla, ${name}! Vazifalarni a'lo darajada bajaryapsiz!`,
                ``,
                `📋 Vazifa: ${statusText}`,
                `💰 Sizga 5 ta coin berildi.`,
                `📊 Jami coinlaringiz: ${totalCoins} ta.`,
                `🏆 Guruhda coin yig'ish bo'yicha hozirda ${rank}-o'rindasiz. Shunday davom eting! 🚀`,
            ].join('\n');

            await bot.sendMessage(chatId, message, { reply_to_message_id: messageId });
            return true;
        } catch (error) {
            console.error('Error processing task:', error);
            return false;
        }
    }

    private static async processAttendance(
        chatId: number,
        sheetId: string,
        name: string,
        messageId: number
    ): Promise<boolean> {
        try {
            const result = await sheetsService.markAttendance(sheetId, name);

            if (!result) {
                await bot.sendMessage(chatId, `❌ Xatolik yuz berdi. Google Sheets bilan bog'lanib bo'lmadi.`, {
                    reply_to_message_id: messageId,
                });
                return true;
            }

            const totalCoins = await sheetsService.getTotalCoins(sheetId, name);
            const rank = await sheetsService.getStudentRank(sheetId, name);

            const message = [
                `✅ Barakalla, ${name}! Darsga qatnashganingiz uchun rahmat! 📚`,
                ``,
                `📝 Davomat: Belgilandi`,
                `💰 Sizga 5 ta coin berildi.`,
                `📊 Jami coinlaringiz: ${totalCoins} ta.`,
                `🏆 Guruhda coin yig'ish bo'yicha hozirda ${rank}-o'rindasiz. Shunday davom eting! 🚀`,
            ].join('\n');

            await bot.sendMessage(chatId, message, { reply_to_message_id: messageId });
            return true;
        } catch (error) {
            console.error('Error processing attendance:', error);
            return false;
        }
    }

    static async sendInactivityWarning(chatId: number | string, sheetId: string, name: string): Promise<void> {
        const message = `⚠️ #${name}, siz darslarga qatnashmayapsiz va vazifalarni topshirmayapsiz. Maqsadingizga erishish uchun faolroq bo'lishingiz kerak! Sizni darslarda kutamiz. 💪`;
        await bot.sendMessage(chatId, message);
    }
}
