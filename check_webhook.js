const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN || '', { polling: false });

async function checkWebhook() {
    try {
        console.log("Checking webhook...");
        const webhookInfo = await bot.getWebHookInfo();
        console.log("Webhook Info:", JSON.stringify(webhookInfo, null, 2));

        if (webhookInfo.url) {
            console.log("Webhook is set. Deleting webhook...");
            await bot.deleteWebHook();
            console.log("Webhook deleted. You can now use Polling.");
        } else {
            console.log("No webhook set. Polling should work.");
        }
    } catch (error) {
        console.error("Error checking/deleting webhook:", error);
    }
}

checkWebhook();
