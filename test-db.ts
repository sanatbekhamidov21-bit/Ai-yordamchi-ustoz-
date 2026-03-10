import prisma from './src/database/prisma';

async function run() {
    try {
        const groups = await prisma.group.findMany();
        console.log('✅ Connection successful. Groups in DB:', groups.length);
    } catch (error) {
        console.error('❌ Connection failed:', error);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

run();
