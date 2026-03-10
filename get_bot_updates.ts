import bot from './src/services/bot.service';

interface Chat {
    id: number;
    title?: string;
    type: string;
}

async function getUpdates() {
    try {
        const updates = await bot.getUpdates({ limit: 10, offset: -1 });
        console.log("Recent updates:", JSON.stringify(updates, null, 2));

        const groupChats: Chat[] = [];
        updates.forEach(u => {
            const chat = u.message?.chat || u.my_chat_member?.chat;
            if (chat && (chat.type === 'group' || chat.type === 'supergroup')) {
                groupChats.push(chat as Chat);
            }
        });

        if (groupChats.length > 0) {
            console.log("Possible Group IDs found:");
            groupChats.forEach(chat => console.log(`${chat.title || 'Untitled'}: ${chat.id}`));
        } else {
            console.log("No recent group chat interactions found.");
        }
    } catch (error) {
        console.error("Error fetching updates:", error);
    }
}

getUpdates();
