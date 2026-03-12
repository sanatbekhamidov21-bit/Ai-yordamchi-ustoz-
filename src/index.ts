import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import bot from './services/bot.service';
import { BotController } from './controllers/bot.controller';
import { SchedulerService } from './services/scheduler.service';
import { webhookAuth } from './middlewares/bot.middleware';

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

// 1. Listeners setup immediately
bot.on('message', BotController.handleMessage);
bot.on('callback_query', BotController.handleCallback);

// 2. Webhook route
app.post(`/bot${process.env.BOT_TOKEN}`, webhookAuth, async (req, res) => {
    try {
        await bot.processUpdate(req.body);
    } catch (err) {
        console.error('Bot Error:', err);
    }
    res.sendStatus(200);
});

// 3. Simple routes
app.get('/', (req, res) => res.send('AI Teacher Bot (Google Sheets Mode) is Active!'));
app.get('/health', (req, res) => res.send('OK'));

// 4. Background setup
const init = async () => {
    try {
        console.log('Bot starting init (Google Sheets mode)...');

        if (process.env.NODE_ENV === 'production' && process.env.BASE_WEBHOOK_URL) {
            const url = `${process.env.BASE_WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`;
            await bot.setWebHook(url, { secret_token: process.env.SECRET_TOKEN });
            console.log('Webhook set successfully');
        }

        // Only run simplified scheduler parts
        SchedulerService.init();
    } catch (e) {
        console.error('❌ Init error:', e);
    }
};

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Live on port ${port}`);
        init();
    });
} else {
    init();
}

export default app;
