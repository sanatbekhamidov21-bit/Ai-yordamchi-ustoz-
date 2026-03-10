import prisma from './src/database/prisma';

async function checkGroups() {
    try {
        const groups = await prisma.group.findMany();
        console.log("Groups found:", JSON.stringify(groups, null, 2));
    } catch (error) {
        console.error("Error fetching groups:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkGroups();
