import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN || '';
const isDev = process.env.NODE_ENV === 'development';

let bot: TelegramBot;

if (isDev) {
    bot = new TelegramBot(token, { polling: true });
} else {
    // Webhook will be set up via Express
    bot = new TelegramBot(token);
}

export default bot;
