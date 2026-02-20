import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

export const webhookAuth = (req: Request, res: Response, next: NextFunction) => {
    const secret = process.env.SECRET_TOKEN;
    const headerToken = req.headers['x-telegram-bot-api-secret-token'];

    if (secret && headerToken !== secret) {
        return res.status(401).send('Unauthorized');
    }
    next();
};

export const rateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP or User logic (here simplified by IP)
    message: "Juda ko'p xabar yubordingiz. Iltimos 1 daqiqa kuting.",
});
