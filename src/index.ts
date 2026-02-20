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

app.use(helmet());
app.use(cors());
app.use(express.json());

// 1. Webhook endpoint
app.post(`/bot${process.env.BOT_TOKEN}`, webhookAuth, (req: express.Request, res: express.Response) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// 2. Health check
app.get('/health', (req: express.Request, res: express.Response) => res.send('OK'));

// 3. Initialize Polling or Webhook
const setupBot = async () => {
    if (process.env.NODE_ENV === 'development') {
        console.log('Bot starting in Polling mode...');
        bot.on('message', BotController.handleMessage);
    } else {
        console.log('Bot starting in Webhook mode...');
        const url = `${process.env.BASE_WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`;
        await bot.setWebHook(url, {
            secret_token: process.env.SECRET_TOKEN
        });
        bot.on('message', BotController.handleMessage);
    }
}

app.listen(port, async () => {
    console.log(`Server running on port ${port}`);

    await setupBot();
    SchedulerService.init();
});
