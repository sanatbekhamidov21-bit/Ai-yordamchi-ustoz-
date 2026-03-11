import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import bot from './services/bot.service';
import { BotController } from './controllers/bot.controller';
import { SchedulerService } from './services/scheduler.service';
import { webhookAuth } from './middlewares/bot.middleware';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());

// 1. Webhook endpoint
app.post(`/bot${process.env.BOT_TOKEN}`, webhookAuth, async (req: express.Request, res: express.Response) => {
    try {
        await bot.processUpdate(req.body);
    } catch (err) {
        console.error('Bot process update error:', err);
    }
    res.sendStatus(200);
});

// 2. Health check
app.get('/health', (req: express.Request, res: express.Response) => res.send('OK'));

// 1. Attach listeners immediately (important for Serverless)
bot.on('message', BotController.handleMessage);
bot.on('callback_query', BotController.handleCallback);

// 2. Webhook endpoint
app.post(`/bot${process.env.BOT_TOKEN}`, webhookAuth, async (req: express.Request, res: express.Response) => {
    try {
        console.log('Received update from Telegram');
        await bot.processUpdate(req.body);
    } catch (err) {
        console.error('Bot process update error:', err);
    }
    // Always respond 200 to Telegram
    res.sendStatus(200);
});

// 3. Health check
app.get('/health', (req: express.Request, res: express.Response) => res.send('OK'));

// 4. Setup function (only for setting the webhook once)
const setupBot = async () => {
    if (process.env.NODE_ENV === 'development') {
        console.log('Bot starting in Polling mode...');
    } else {
        const url = `${process.env.BASE_WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`;
        console.log(`Ensuring webhook at: ${url}`);
        // Only set if needed or skip and set manually
        await bot.setWebHook(url, {
            secret_token: process.env.SECRET_TOKEN
        }).catch(err => console.error('SetWebhook failed:', err));
    }
    SchedulerService.init();
};

// Deployment specific startup
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, async () => {
        console.log(`Server running on port ${port}`);
        await setupBot();
    });
} else {
    // In production, just ensure scheduler is running or handled
    // Vercel calls setup internally or we can trigger it
    setupBot().catch(err => console.error('Setup failed:', err));
}

export default app;
