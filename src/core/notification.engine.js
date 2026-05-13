import { query } from '../db/db.js';

/**
 * The Notification Engine acts as a bridge. 
 * We store references to the running bot instances here to trigger messages 
 * from the backend API without circular dependencies.
 */

let userBotInstance = null;
let adminBotInstance = null;

export function setBotInstances(userBot, adminBot) {
    userBotInstance = userBot;
    adminBotInstance = adminBot;
}

export async function notifyNewReferral(userId, amount, level) {
    if (!userBotInstance) return;
    
    try {
        const userRes = await query(`SELECT telegram_id, language FROM users WHERE id = $1`, [userId]);
        if (userRes.rows.length === 0) return;
        
        const { telegram_id, language } = userRes.rows[0];
        
        const text = language === 'uz' 
            ? `🎉 Yangi taklif (${level}-daraja)! Sizga ${amount} so'm qo'shildi.`
            : `🎉 New referral (Level ${level})! You earned ${amount}.`;
            
        await userBotInstance.telegram.sendMessage(telegram_id, text);
    } catch (e) {
        console.error("Failed to notify user about referral:", e);
    }
}

export async function notifyPaymentUpdate(userId, paymentInfo) {
    if (!userBotInstance) return;

    try {
        const userRes = await query(`SELECT telegram_id, language FROM users WHERE id = $1`, [userId]);
        if (userRes.rows.length === 0) return;

        const { telegram_id, language } = userRes.rows[0];
        
        const text = language === 'uz'
            ? `💰 To'lov holati yangilandi! Holat: ${paymentInfo.status}\nTo'langan: ${paymentInfo.amountPaid}`
            : `💰 Payment updated! Status: ${paymentInfo.status}\nPaid: ${paymentInfo.amountPaid}`;

        // If proof image is provided, send as photo with text as caption
        if (paymentInfo.fileId) {
            await userBotInstance.telegram.sendPhoto(telegram_id, paymentInfo.fileId, { caption: text });
        } else {
            await userBotInstance.telegram.sendMessage(telegram_id, text);
        }
    } catch (e) {
        console.error("Failed to notify user about payment update:", e);
    }
}
