import { Telegraf } from 'telegraf';
import { query } from '../db/db.js';
import { processPartialPayment } from '../core/payment.engine.js';

export function setupAdminBot() {
    const bot = new Telegraf(process.env.ADMIN_BOT_TOKEN);

    // Middleware to check admin role
    bot.use(async (ctx, next) => {
        if (!ctx.from) return next();
        
        try {
            const res = await query(`SELECT role FROM users WHERE telegram_id = $1`, [ctx.from.id]);
            if (res.rows.length === 0 || !['admin', 'super_admin'].includes(res.rows[0].role)) {
                // Not an admin, ignore or reply
                // await ctx.reply('Unauthorized access.');
                return; 
            }
        } catch (e) {
            console.error("Admin check error:", e);
            return;
        }
        return next();
    });

    bot.command('admin', async (ctx) => {
        await ctx.reply('Admin Panel:\n/pending_payments - View pending\n/pay <payment_id> <amount> - Process payment (reply with photo)');
    });

    bot.command('pending_payments', async (ctx) => {
        try {
            const res = await query(`SELECT id, user_id, remaining_amount FROM payments WHERE status IN ('pending', 'partial') LIMIT 10`);
            if (res.rows.length === 0) {
                return ctx.reply("No pending payments.");
            }
            let text = "Pending Payments:\n\n";
            res.rows.forEach(p => {
                text += `ID: \`${p.id}\`\nRemaining: ${p.remaining_amount}\n\n`;
            });
            await ctx.replyWithMarkdown(text);
        } catch (e) {
            await ctx.reply("Error fetching payments.");
        }
    });

    // Handle payment processing with photo upload
    bot.on('photo', async (ctx) => {
        // Look for caption: /pay <payment_id> <amount>
        const caption = ctx.message.caption;
        if (!caption || !caption.startsWith('/pay')) return;

        const parts = caption.split(' ');
        if (parts.length !== 3) {
            return ctx.reply("Usage in caption: /pay <payment_id> <amount>");
        }

        const paymentId = parts[1];
        const amount = parseFloat(parts[2]);
        // Get highest resolution photo file_id
        const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

        try {
            const result = await processPartialPayment(paymentId, amount, fileId);
            await ctx.reply(`Payment updated successfully!\nNew Status: ${result.status}\nRemaining: ${result.remaining}`);
        } catch (e) {
            console.error("Payment process error:", e);
            await ctx.reply(`Error processing payment: ${e.message}`);
        }
    });

    return bot;
}
