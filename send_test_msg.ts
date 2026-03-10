import bot from './src/services/bot.service';
import dotenv from 'dotenv';
dotenv.config();

const groupId = process.env.GROUP_ID || '-1002446755497';
const message = "Salom hammaga! Bugun 21:00 gacha uyga vazifani yuboring.";

async function sendMessage() {
    try {
        await bot.sendMessage(groupId, message);
        console.log("Xabar muvaffaqiyatli yuborildi!");
    } catch (error) {
        console.error("Xabar yuborishda xatolik:", error);
    }
}

sendMessage();
