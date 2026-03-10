import bot from './src/services/bot.service';

async function testToken() {
    try {
        const me = await bot.getMe();
        console.log('✅ Bot is running properly!');
        console.log('Bot Username:', me.username);
        console.log('Bot ID:', me.id);

        // Try to send a message to a hardcoded channel if defined
        const channelId = process.env.CHANNEL_ID;
        if (channelId) {
            await bot.sendMessage(channelId, '🔄 Bot qayta ishga tushirildi va sinovdan muvaffaqiyatli o\'tdi!');
            console.log('✅ Test message sent to channel!');
        }
    } catch (error) {
        console.error('❌ Bot error:', error);
    } finally {
        process.exit(0);
    }
}

testToken();
