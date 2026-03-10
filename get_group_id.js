const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

async function findGroup() {
    try {
        const updates = await bot.getUpdates({ limit: 100, offset: -100 });
        let groupId = null;
        for (const u of updates) {
            const chat = u.message?.chat || u.my_chat_member?.chat;
            if (chat && (chat.type === 'group' || chat.type === 'supergroup')) {
                console.log(`Found group: ${chat.title} (ID: ${chat.id})`);
                groupId = chat.id;
            }
        }

        if (groupId) {
            console.log(`Latest Group ID is: ${groupId}`);
            // Let's also send the message right now
            const message = 'Salom hammaga! Bugun 21:00 gacha uyga vazifani yuboring.';
            await bot.sendMessage(groupId, message);
            console.log('Xabar muvaffaqiyatli yuborildi!');
        } else {
            console.log("Hali guruhdan xabar kelmadi yoki bot guruhda admin emas.");
        }
    } catch (error) {
        console.error("Xatolik:", error.message);
    }
}

findGroup();
