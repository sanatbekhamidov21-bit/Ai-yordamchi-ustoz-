import cron from 'node-cron';
import prisma from '../database/prisma';
import redis from '../services/redis.service';
import bot from '../services/bot.service';
import { smmAgent } from '../agents/smm.agent';
import { sheetsService } from './sheets.service';
import { CoinsController } from '../controllers/coins.controller';

export class SchedulerService {
    static init() {
        // 1. Daily Post at 09:00
        cron.schedule('0 9 * * *', async () => {
            console.log('Generating daily post...');
            await SchedulerService.handleDailyPost();
        });

        // 2. Deadline Check every 1 minute
        cron.schedule('* * * * *', async () => {
            await SchedulerService.checkDeadlines();
        });

        // 3. Daily Inactivity Check at 21:00
        cron.schedule('0 21 * * *', async () => {
            console.log('Checking inactive students...');
            await SchedulerService.checkInactiveStudents();
        });
    }

    private static async handleDailyPost() {
        const channelId = process.env.CHANNEL_ID;
        if (!channelId) return;

        const lastPosts = await prisma.channelPost.findMany({
            orderBy: { postedAt: 'desc' },
            take: 20,
        });

        const postContent = await smmAgent.generateDailyPost(
            lastPosts.map((p: any) => p.content),
            {} // Engagement data placeholder
        );

        const sentMsg = await bot.sendMessage(channelId, postContent);

        await prisma.channelPost.create({
            data: {
                telegramMsgId: sentMsg.message_id,
                content: postContent,
                type: 'GRAMMAR', // Simple logic for now
            },
        });
    }

    private static async checkDeadlines() {
        const activeHwId = await redis.get('active_hw_id');
        if (!activeHwId) return;

        const deadlineStr = await redis.get(`hw_deadline:${activeHwId}`);
        if (!deadlineStr) return;

        const deadline = new Date(deadlineStr);
        if (new Date() > deadline) {
            console.log(`Deadline reached for HW ${activeHwId}`);
            await SchedulerService.processDeadline(activeHwId);
        }
    }

    private static async processDeadline(hwId: string) {
        const hw = await prisma.homework.findUnique({ where: { id: hwId } });
        if (!hw) return;

        // 1. Update HW status
        await prisma.homework.update({
            where: { id: hwId },
            data: { isActive: false },
        });

        // 2. Clear active state
        await redis.del('active_hw_id');
        await redis.del(`hw_deadline:${hwId}`);

        // 3. Notify and stats
        const submissions = await prisma.submission.findMany({ where: { hwId } });
        const students = await prisma.user.findMany({ where: { role: 'STUDENT' } });

        const submittedUserIds = new Set(submissions.map((s: any) => s.userId));
        const missingStudents = students.filter((s: any) => !submittedUserIds.has(s.id));

        let report = `⏰ **Deadline yakunlandi!** (#HW${hw.hwNumber})\n\n`;
        report += `Topshirganlar: ${submissions.length}\n`;
        report += `Topshirmaganlar: ${missingStudents.length}\n`;

        if (missingStudents.length > 0) {
            report += "\nQuyidagi o'quvchilar vazifani o'z vaqtida topshirmadi:\n";
            missingStudents.forEach((s: any) => report += `@${s.username || s.fullName} `);
        }

        // Assume group ID is stored or we use a fixed one for now
        const groupId = process.env.GROUP_ID;
        if (groupId) await bot.sendMessage(groupId, report, { parse_mode: 'Markdown' });
    }

    /**
     * Check for students who have been inactive for 2+ days
     * Sends warning messages to the group
     */
    private static async checkInactiveStudents() {
        try {
            const groups = await prisma.group.findMany({
                where: {
                    googleSheetId: { not: null },
                    telegramId: { not: null }
                }
            });

            for (const group of groups) {
                const sheetId = group.googleSheetId!;
                const telegramId = group.telegramId!;

                console.log(`Checking inactivity for group: ${group.name} (${telegramId})`);
                const inactiveStudents = await sheetsService.getInactiveStudents(sheetId, 2);

                for (const name of inactiveStudents) {
                    await CoinsController.sendInactivityWarning(telegramId, sheetId, name);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error('Error checking inactive students:', error);
        }
    }
}
