const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
const groupId = process.env.GROUP_ID || '-1002446755497';
const message = 'Salom hammaga! Bugun 21:00 gacha uyga vazifani yuboring.';

bot.sendMessage(groupId, message)
    .then(() => {
        console.log('Xabar muvaffaqiyatli yuborildi!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Xatolik:', err.message);
        process.exit(1);
    });
