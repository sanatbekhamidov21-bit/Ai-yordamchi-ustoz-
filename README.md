# AI Teacher Assistant Bot

A production-ready Telegram bot for English teachers, built with Node.js, TypeScript, PostgreSQL, and Google Gemini AI.

## Features
- **Channel SMM Manager**: Automatic daily post generation based on engagement.
- **Group Classroom Manager**: Homework tracking, student registry, and deadline management.
- **AI English Teacher**: Automatic homework evaluation (rubric-based) and student Q&A.
- **Analytics**: Leaderboard and homework completion reports.

## Tech Stack
- **Backend**: Node.js, TypeScript, Express
- **ORM**: Prisma (PostgreSQL)
- **Cache**: Redis
- **AI**: Google Gemini API (gemini-1.5-flash)
- **Scheduler**: node-cron

## Setup Instructions

### 1. Prerequisites
- Docker & Docker Compose
- Telegram Bot Token (from @BotFather)
- Google AI Studio API Key (for Gemini)

### 2. Configuration
Create a `.env` file in the root directory (based on `.env.example`):
```env
PORT=3000
BOT_TOKEN=your_token
DATABASE_URL="postgresql://user:password@db:5432/teacher_assistant?schema=public"
GEMINI_API_KEY=your_key
REDIS_URL="redis://redis:6379"
BASE_WEBHOOK_URL=https://your-domain.com
SECRET_TOKEN=some_random_secret
CHANNEL_ID=-100...
GROUP_ID=-100...
```

### 3. Deployment
Run the system using Docker Compose:
```bash
docker-compose up -d
```

The system will:
1. Start PostgreSQL and Redis.
2. Build the Node.js application.
3. Generate Prisma client.
4. Set up the Telegram Webhook.
5. Start the Express server and Cron schedules.

## Usage
- **Homework**: Post `#HW12 [Description] Deadline 20:00` in the group.
- **Admin**: Use `/admin_post [topic]` to generate a post.
- **Students**: Simply reply with at least 3 sentences to submit homework or ask questions.
- **Leaderboard**: Use `/progress`.

## Architecture
- `src/agents`: AI Persona definitions.
- `src/controllers`: Request/Message handling logic.
- `src/services`: External API integrations (Bot, Redis).
- `src/database`: Prisma setup.
