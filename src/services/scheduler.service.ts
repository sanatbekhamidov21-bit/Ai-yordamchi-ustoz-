import cron from 'node-cron';
import bot from '../services/bot.service';
import { sheetsService } from './sheets.service';

const MAIN_SHEET_ID = process.env.GOOGLE_SHEETS_ID || '';

export class SchedulerService {
    static init() {
        // Daily Inactivity Check at 21:00
        cron.schedule('0 21 * * *', async () => {
            console.log('Checking inactive students...');
            await SchedulerService.checkInactiveStudents();
        });

        console.log('⏰ Scheduler initialized (Limited mode)');
    }

    private static async checkInactiveStudents() {
        if (!MAIN_SHEET_ID) return;
        try {
            console.log(`Checking inactivity for main sheet: ${MAIN_SHEET_ID}`);
            const inactiveStudents = await sheetsService.getInactiveStudents(MAIN_SHEET_ID, 3);

            const groupId = process.env.GROUP_ID;
            if (groupId && inactiveStudents.length > 0) {
                let report = "⚠️ **Noaktiv o'quvchilar (oxirgi 3 kunda):**\n\n";
                inactiveStudents.forEach(name => report += `- ${name}\n`);
                report += "\nIltimos, darslarni davom ettiring! 🔥";
                await bot.sendMessage(groupId, report, { parse_mode: 'Markdown' });
            }
        } catch (error) {
            console.error('Error checking inactive students:', error);
        }
    }
}
