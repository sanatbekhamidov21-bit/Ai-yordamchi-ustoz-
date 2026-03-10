import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN || '', { polling: false });

async function checkWebhook() {
    try {
        const webhookInfo = await bot.getWebhookInfo();
        console.log("Webhook Info:", JSON.stringify(webhookInfo, null, 2));

        if (webhookInfo.url) {
            console.log("Webhook is set. Deleting webhook...");
            await bot.deleteWebhook();
            console.log("Webhook deleted. You can now use Polling.");
        } else {
            console.log("No webhook set. Polling should work.");
        }
    } catch (error) {
        console.error("Error checking webhook:", error);
    }
}

checkWebhook();
