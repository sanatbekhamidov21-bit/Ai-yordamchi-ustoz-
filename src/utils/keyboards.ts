import { ReplyKeyboardMarkup, KeyboardButton } from 'node-telegram-bot-api';

export const startKeyboard: ReplyKeyboardMarkup = {
    keyboard: [
        [{ text: "👨‍🏫 O'qituvchi" }, { text: "👨‍🎓 O'quvchi" }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
};

export const teacherKeyboard: ReplyKeyboardMarkup = {
    keyboard: [
        [{ text: "🤖 AI Boshqaruv" }, { text: "📊 Statistika" }],
        [{ text: "➕ Guruh yaratish" }, { text: "📝 Vazifa berish" }],
        [{ text: "🏠 Asosiy menyu" }]
    ],
    resize_keyboard: true
};

export const studentKeyboard: ReplyKeyboardMarkup = {
    keyboard: [
        [{ text: "📥 Vazifa yuborish" }, { text: "👤 Profil" }],
        [{ text: "🏠 Asosiy menyu" }]
    ],
    resize_keyboard: true
};
