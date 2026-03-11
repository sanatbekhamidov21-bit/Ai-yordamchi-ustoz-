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

// 3. Initialize Polling or Webhook
let isBotSetup = false;
const setupBot = async () => {
    if (isBotSetup) return;

    bot.on('message', BotController.handleMessage);
    bot.on('callback_query', BotController.handleCallback);

    if (process.env.NODE_ENV === 'development') {
        console.log('Bot starting in Polling mode...');
    } else {
        const url = `${process.env.BASE_WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`;
        console.log(`Setting webhook to: ${url}`);
        await bot.setWebHook(url, {
            secret_token: process.env.SECRET_TOKEN
        });
    }

    SchedulerService.init();
    isBotSetup = true;
};

// For Vercel Serverless
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, async () => {
        console.log(`Server running on port ${port}`);
        await setupBot();
    });
} else {
    // In production (Vercel), setup once if possible, but don't block request flow
    setupBot().catch(err => console.error('Setup failed:', err));
}

export default app;
