/**
 * Setup Script — Google Sheets jadvalini avtomatik sozlash
 * Bu skript credentials.json va GOOGLE_SHEETS_ID sozlangandan keyin ishga tushiriladi.
 * U jadvalga kerakli ustun sarlavhalarini yozadi.
 * 
 * Ishga tushirish: npx ts-node setup_sheets.ts
 */

import { google } from 'googleapis';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '';
const SHEET_TAB = process.env.GOOGLE_SHEETS_TAB || 'Sheet1';
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';

async function setupSheet() {
    console.log('🔧 Google Sheets jadvalini sozlash boshlanmoqda...\n');

    if (!SPREADSHEET_ID || SPREADSHEET_ID === 'your_spreadsheet_id_here') {
        console.error('❌ GOOGLE_SHEETS_ID .env faylida sozlanmagan!');
        console.error('   .env faylini ochib, GOOGLE_SHEETS_ID= qatoriga jadvalingiz IDsini yozing.');
        process.exit(1);
    }

    try {
        const credentialsPath = path.resolve(CREDENTIALS_PATH);
        const auth = new google.auth.GoogleAuth({
            keyFile: credentialsPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const authClient = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: authClient as any });

        console.log('✅ Google Sheets APIga ulanish muvaffaqiyatli!\n');

        // Check if headers already exist
        const existing = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_TAB}!A1:E1`,
        });

        if (existing.data.values && existing.data.values[0] && existing.data.values[0].length >= 5) {
            console.log('ℹ️  Jadvalda allaqachon sarlavhalar bor:');
            console.log(`   ${existing.data.values[0].join(' | ')}`);
            console.log('\n✅ Jadval tayyor! Bot ishga tushirishga tayyor.');
            return;
        }

        // Write headers
        const headers = [['Ism', 'Vazifa Holati', 'Davomat', 'Jami Coinlar', 'Oxirgi faollik sanasi']];

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_TAB}!A1:E1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: headers },
        });

        console.log('✅ Jadval sarlavhalari muvaffaqiyatli yozildi:');
        console.log('   Ism | Vazifa Holati | Davomat | Jami Coinlar | Oxirgi faollik sanasi');

        // Format headers bold (optional styling)
        try {
            const spreadsheet = await sheets.spreadsheets.get({
                spreadsheetId: SPREADSHEET_ID,
            });

            const sheetId = spreadsheet.data.sheets?.[0]?.properties?.sheetId || 0;

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId: sheetId,
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                    startColumnIndex: 0,
                                    endColumnIndex: 5,
                                },
                                cell: {
                                    userEnteredFormat: {
                                        textFormat: { bold: true },
                                        backgroundColor: { red: 0.2, green: 0.6, blue: 0.9 },
                                    },
                                },
                                fields: 'userEnteredFormat(textFormat,backgroundColor)',
                            },
                        },
                        {
                            updateDimensionProperties: {
                                range: {
                                    sheetId: sheetId,
                                    dimension: 'COLUMNS',
                                    startIndex: 0,
                                    endIndex: 5,
                                },
                                properties: { pixelSize: 180 },
                                fields: 'pixelSize',
                            },
                        },
                    ],
                },
            });

            console.log('✅ Sarlavhalar formatlandi (bold, rang, kenglik)');
        } catch (e) {
            console.log('⚠️  Formatlash bajarilmadi, lekin sarlavhalar yozildi.');
        }

        console.log('\n🎉 Jadval tayyor! Endi botni ishga tushirishingiz mumkin: npm run dev');

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.error('❌ credentials.json fayli topilmadi!');
            console.error('   Google Cloud Console\'dan Service Account key yuklab oling.');
        } else if (error.message?.includes('invalid_grant') || error.message?.includes('Could not load')) {
            console.error('❌ credentials.json fayli noto\'g\'ri yoki buzilgan!');
            console.error('   To\'g\'ri Service Account JSON key ekanligini tekshiring.');
        } else if (error.code === 404) {
            console.error('❌ Spreadsheet topilmadi! GOOGLE_SHEETS_ID ni tekshiring.');
        } else if (error.code === 403) {
            console.error('❌ Ruxsat yo\'q! Service Account emailini jadvalga Editor sifatida qo\'shing.');
            console.error('   Email: credentials.json ichidagi "client_email" qiymatini Google Sheets\'ga share qiling.');
        } else {
            console.error('❌ Xatolik:', error.message || error);
        }
        process.exit(1);
    }
}

setupSheet();
