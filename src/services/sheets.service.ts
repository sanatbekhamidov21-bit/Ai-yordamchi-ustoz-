import { google, sheets_v4 } from 'googleapis';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '';
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';

const VAZIFA_TAB = 'Vazifalar';
const DAVOMAT_TAB = 'Davomat';

class SheetsService {
    private sheets: sheets_v4.Sheets | null = null;
    private initialized = false;
    private initializedSheets = new Set<string>();

    async init(): Promise<boolean> {
        if (this.initialized && this.sheets) return true;

        try {
            const credentialsPath = path.resolve(CREDENTIALS_PATH);
            const auth = new google.auth.GoogleAuth({
                keyFile: credentialsPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            const authClient = await auth.getClient();
            this.sheets = google.sheets({ version: 'v4', auth: authClient as any });
            this.initialized = true;

            console.log('✅ Google Sheets service base initialized');
            return true;
        } catch (error) {
            console.error('❌ Google Sheets initialization failed:', error);
            return false;
        }
    }

    async ensureTabs(spreadsheetId: string) {
        if (!this.sheets || this.initializedSheets.has(spreadsheetId)) return;

        try {
            const spreadsheet = await this.sheets.spreadsheets.get({
                spreadsheetId,
            });

            const existingTabs = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];

            const tabsToCreate: string[] = [];
            if (!existingTabs.includes(VAZIFA_TAB)) tabsToCreate.push(VAZIFA_TAB);
            if (!existingTabs.includes(DAVOMAT_TAB)) tabsToCreate.push(DAVOMAT_TAB);

            if (tabsToCreate.length > 0) {
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: tabsToCreate.map(title => ({
                            addSheet: { properties: { title } },
                        })),
                    },
                });

                for (const tab of tabsToCreate) {
                    if (tab === VAZIFA_TAB) {
                        await this.sheets.spreadsheets.values.update({
                            spreadsheetId,
                            range: `${VAZIFA_TAB}!A1:D1`,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: {
                                values: [['Ism', 'Vazifa Holati', 'Jami Coinlar', 'Oxirgi faollik sanasi']],
                            },
                        });
                    } else if (tab === DAVOMAT_TAB) {
                        await this.sheets.spreadsheets.values.update({
                            spreadsheetId,
                            range: `${DAVOMAT_TAB}!A1:D1`,
                            valueInputOption: 'USER_ENTERED',
                            requestBody: {
                                values: [['Ism', 'Davomat soni', 'Jami Coinlar', 'Oxirgi faollik sanasi']],
                            },
                        });
                    }
                }
                console.log(`✅ Yangi tablar yaratildi jadvalda: ${spreadsheetId}`);
            }
            this.initializedSheets.add(spreadsheetId);
        } catch (error) {
            console.error('Tab yaratishda xatolik:', error);
        }
    }

    private async findStudentRow(spreadsheetId: string, tab: string, name: string): Promise<number> {
        if (!this.sheets) return -1;

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${tab}!A:A`,
            });

            const rows = response.data.values || [];
            const normalizedName = name.toLowerCase().trim().replace(/[''`]/g, '');

            for (let i = 0; i < rows.length; i++) {
                const cellName = (rows[i][0] || '').toString().toLowerCase().trim().replace(/[''`]/g, '');
                if (cellName === normalizedName) {
                    return i + 1;
                }
            }
            return -1;
        } catch (error) {
            console.error('Error finding student:', error);
            return -1;
        }
    }

    async markTask(spreadsheetId: string, name: string, status: "to'liq" | "yarim"): Promise<{ coins: number } | null> {
        if (!await this.init()) return null;
        await this.ensureTabs(spreadsheetId);

        const today = new Date().toLocaleDateString('uz-UZ');
        const rowIndex = await this.findStudentRow(spreadsheetId, VAZIFA_TAB, name);

        try {
            if (rowIndex === -1) {
                await this.sheets!.spreadsheets.values.append({
                    spreadsheetId,
                    range: `${VAZIFA_TAB}!A:D`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[name, `Bajarildi (${status})`, '5', today]],
                    },
                });
                return { coins: 5 };
            } else {
                const row = await this.getRow(spreadsheetId, VAZIFA_TAB, rowIndex, 'A', 'D');
                const currentCoins = parseInt(row?.[2] || '0') || 0;
                const newCoins = currentCoins + 5;

                await this.sheets!.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${VAZIFA_TAB}!B${rowIndex}:D${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[`Bajarildi (${status})`, newCoins.toString(), today]],
                    },
                });
                return { coins: newCoins };
            }
        } catch (error) {
            console.error('Error marking task:', error);
            return null;
        }
    }

    async markAttendance(spreadsheetId: string, name: string): Promise<{ coins: number } | null> {
        if (!await this.init()) return null;
        await this.ensureTabs(spreadsheetId);

        const today = new Date().toLocaleDateString('uz-UZ');
        const rowIndex = await this.findStudentRow(spreadsheetId, DAVOMAT_TAB, name);

        try {
            if (rowIndex === -1) {
                await this.sheets!.spreadsheets.values.append({
                    spreadsheetId,
                    range: `${DAVOMAT_TAB}!A:D`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[name, '1', '5', today]],
                    },
                });
                return { coins: 5 };
            } else {
                const row = await this.getRow(spreadsheetId, DAVOMAT_TAB, rowIndex, 'A', 'D');
                const currentCount = parseInt(row?.[1] || '0') || 0;
                const currentCoins = parseInt(row?.[2] || '0') || 0;
                const newCoins = currentCoins + 5;

                await this.sheets!.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${DAVOMAT_TAB}!B${rowIndex}:D${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[(currentCount + 1).toString(), newCoins.toString(), today]],
                    },
                });
                return { coins: newCoins };
            }
        } catch (error) {
            console.error('Error marking attendance:', error);
            return null;
        }
    }

    private async getRow(spreadsheetId: string, tab: string, rowIndex: number, startCol: string, endCol: string): Promise<string[] | null> {
        try {
            const response = await this.sheets!.spreadsheets.values.get({
                spreadsheetId,
                range: `${tab}!${startCol}${rowIndex}:${endCol}${rowIndex}`,
            });
            return response.data.values?.[0] || null;
        } catch {
            return null;
        }
    }

    async getTotalCoins(spreadsheetId: string, name: string): Promise<number> {
        if (!await this.init()) return 0;
        await this.ensureTabs(spreadsheetId);

        let total = 0;
        const vazifaRow = await this.findStudentRow(spreadsheetId, VAZIFA_TAB, name);
        if (vazifaRow !== -1) {
            const row = await this.getRow(spreadsheetId, VAZIFA_TAB, vazifaRow, 'A', 'D');
            total += parseInt(row?.[2] || '0') || 0;
        }

        const davomatRow = await this.findStudentRow(spreadsheetId, DAVOMAT_TAB, name);
        if (davomatRow !== -1) {
            const row = await this.getRow(spreadsheetId, DAVOMAT_TAB, davomatRow, 'A', 'D');
            total += parseInt(row?.[2] || '0') || 0;
        }

        return total;
    }

    async getAllStudents(spreadsheetId: string): Promise<Array<{ name: string; coins: number; lastActivity: string }>> {
        if (!await this.init()) return [];
        await this.ensureTabs(spreadsheetId);

        const studentMap: Record<string, { coins: number; lastActivity: string }> = {};

        try {
            const vazifa = await this.sheets!.spreadsheets.values.get({
                spreadsheetId,
                range: `${VAZIFA_TAB}!A2:D`,
            });
            for (const row of (vazifa.data.values || [])) {
                const name = (row[0] || '').toString().toLowerCase().trim();
                if (!name) continue;
                studentMap[name] = {
                    coins: (studentMap[name]?.coins || 0) + (parseInt(row[2] || '0') || 0),
                    lastActivity: row[3] || studentMap[name]?.lastActivity || '',
                };
            }
        } catch { }

        try {
            const davomat = await this.sheets!.spreadsheets.values.get({
                spreadsheetId,
                range: `${DAVOMAT_TAB}!A2:D`,
            });
            for (const row of (davomat.data.values || [])) {
                const name = (row[0] || '').toString().toLowerCase().trim();
                if (!name) continue;
                studentMap[name] = {
                    coins: (studentMap[name]?.coins || 0) + (parseInt(row[2] || '0') || 0),
                    lastActivity: row[3] || studentMap[name]?.lastActivity || '',
                };
            }
        } catch { }

        return Object.entries(studentMap).map(([name, data]) => ({
            name,
            coins: data.coins,
            lastActivity: data.lastActivity,
        }));
    }

    async getStudentRank(spreadsheetId: string, name: string): Promise<number> {
        const students = await this.getAllStudents(spreadsheetId);
        students.sort((a, b) => b.coins - a.coins);
        const normalizedName = name.toLowerCase().trim().replace(/[''`]/g, '');
        const index = students.findIndex(s => s.name.replace(/[''`]/g, '') === normalizedName);
        return index === -1 ? students.length + 1 : index + 1;
    }

    async getInactiveStudents(spreadsheetId: string, dayThreshold: number = 2): Promise<string[]> {
        const students = await this.getAllStudents(spreadsheetId);
        const now = new Date();
        const inactive: string[] = [];

        for (const student of students) {
            if (!student.lastActivity) {
                inactive.push(student.name);
                continue;
            }

            let lastDate: Date | null = null;
            try {
                const parts = student.lastActivity.split(/[\/\.\-]/);
                if (parts.length === 3) {
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1;
                    const year = parseInt(parts[2]);
                    lastDate = new Date(year, month, day);
                }
            } catch { }

            if (lastDate) {
                const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays >= dayThreshold) {
                    inactive.push(student.name);
                }
            }
        }

        return inactive;
    }
}

export const sheetsService = new SheetsService();
