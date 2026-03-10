import prisma from './src/database/prisma';

async function checkUsers() {
    try {
        const users = await prisma.user.findMany();
        // Convert BigInt to string for JSON.stringify
        const serializedUsers = users.map(user => ({
            ...user,
            telegramId: user.telegramId.toString()
        }));
        console.log("Users found:", JSON.stringify(serializedUsers, null, 2));
    } catch (error) {
        console.error("Error fetching users:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUsers();
