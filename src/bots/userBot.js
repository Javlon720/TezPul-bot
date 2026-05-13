import { Telegraf } from 'telegraf';
import { registerReferral } from '../core/referral.engine.js';
import { query } from '../db/db.js';

export function setupUserBot() {
    const bot = new Telegraf(process.env.USER_BOT_TOKEN);

    // Middleware to ensure user exists in DB and get their language
    bot.use(async (ctx, next) => {
        if (!ctx.from) return next();
        
        try {
            // A simple upsert for basic info; registerReferral handles fuller registration
            await query(
                `INSERT INTO users (telegram_id, username, name) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (telegram_id) DO NOTHING`,
                [ctx.from.id, ctx.from.username, ctx.from.first_name]
            );
        } catch (e) {
            console.error("User bot middleware error:", e);
        }
        return next();
    });

    bot.start(async (ctx) => {
        const payload = ctx.payload; // e.g., "ref_<referrerId>_<campaignCode>"
        let referrerId = null;
        let campaignCode = null;

        if (payload && payload.startsWith('ref_')) {
            const parts = payload.split('_');
            if (parts.length >= 3) {
                referrerId = parts[1];
                campaignCode = parts[2];
            }
        }

        const newUserInfo = {
            telegram_id: ctx.from.id,
            username: ctx.from.username,
            name: ctx.from.first_name,
            phone: null // Phone would be collected via a contact request keyboard in a real flow
        };

        const result = await registerReferral(newUserInfo, referrerId, campaignCode);
        
        if (result.message === 'Already referred') {
            await ctx.reply('Xush kelibsiz! Siz allaqachon ro\'yxatdan o\'tgansiz.\nWelcome back!');
        } else {
            await ctx.reply('Xush kelibsiz! Botimizdan foydalanganingiz uchun rahmat.\nWelcome! Thank you for using our bot.');
        }

        // Send Main Menu Dashboard
        await sendDashboard(ctx);
    });

    bot.command('dashboard', async (ctx) => {
        await sendDashboard(ctx);
    });

    bot.command('lang', async (ctx) => {
        // Here we would send inline keyboard to select UZ/RU/EN
        await ctx.reply('Select Language / Tilni tanlang:\n/uz - O\'zbekcha\n/ru - Русский\n/en - English');
    });

    async function sendDashboard(ctx) {
        try {
            const res = await query(`SELECT id, balance, language FROM users WHERE telegram_id = $1`, [ctx.from.id]);
            if (res.rows.length === 0) return;
            
            const user = res.rows[0];
            const referralLink = `https://t.me/${ctx.botInfo.username}?start=ref_${user.id}_default`; // 'default' is placeholder campaign

            const dashText = `
📊 **Sizning Hisobingiz / Your Dashboard**
💰 Balans / Balance: ${user.balance}
🔗 Referal Havola / Referral Link: 
\`${referralLink}\`
            `;
            await ctx.replyWithMarkdown(dashText);
        } catch (e) {
            console.error("Dashboard error:", e);
            await ctx.reply("Error loading dashboard.");
        }
    }

    return bot;
}
