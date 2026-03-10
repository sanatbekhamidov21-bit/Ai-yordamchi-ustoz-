import { ReplyKeyboardMarkup, InlineKeyboardMarkup } from 'node-telegram-bot-api';

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
        [{ text: "📅 Davomat" }, { text: "✍️ Vazifa topshirish" }],
        [{ text: "👤 Profil" }, { text: "🏠 Asosiy menyu" }]
    ],
    resize_keyboard: true
};

export const attendanceKeyboard: ReplyKeyboardMarkup = {
    keyboard: [
        [{ text: "🏠 Asosiy menyu" }]
    ],
    resize_keyboard: true
};

export const groupInlineKeyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
        [
            { text: "👤 Profil", callback_data: "group_profile" },
            { text: "✍️ Feedback", callback_data: "group_feedback" }
        ],
        [
            { text: "👨‍🏫 AI Ustoz", callback_data: "group_ai_teacher" }
        ]
    ]
};
