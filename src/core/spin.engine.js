import { transaction } from '../db/pool.js';
import * as spinQueries from '../db/queries/spin.queries.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

// Slot belgilari — 8 xil. 7 - maxsus jackpot belgisi
const SLOT_SYMBOLS = ['🍋', '🍊', '🍇', '🍒', '⭐', '💎', '7️⃣', '🔔'];
const JACKPOT_SYMBOL = '7️⃣';

// Uch xonali slot natijasini yaratish
// isWin=true bo'lsa — 3 birxil chiqadi (ko'pincha asosiy segment typega mos)
// isWin=false bo'lsa — 3 farqli belgi
function generateSlotReel(isWin, prizeType) {
  if (isWin) {
    // Jackpot (777) yoki boshqa yutish
    if (prizeType === 'pul') {
      // Yuqori qiymatli pulda 777 chiqish ehtimoli bor
      const symbol = JACKPOT_SYMBOL;
      return [symbol, symbol, symbol];
    }
    // Boshqa yutishlar — random birxil belgi
    const sym = SLOT_SYMBOLS[Math.floor(Math.random() * (SLOT_SYMBOLS.length - 1))];
    return [sym, sym, sym];
  }
  // Miss — 3 farqli belgi
  let a, b, c;
  do {
    a = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    b = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    c = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
  } while (a === b && b === c);
  return [a, b, c];
}

export async function playSpin(userId) {
  return transaction(async (client) => {
    if (config.nodeEnv === 'production') {
      const remaining = await spinQueries.consumeSpin(client, userId);
      if (!remaining) throw new Error('NO_SPINS');
    }

    const segments = await spinQueries.getActiveSegments(client);
    if (!segments.length) throw new Error('NO_SEGMENTS');

    const segment = segments[Math.floor(Math.random() * segments.length)];
    const isWin = segment.type !== 'miss';

    await spinQueries.saveSpinResult(
      client, userId, segment.id,
      segment.type, segment.value, isWin
    );

    const reel = generateSlotReel(isWin, segment.type);

    return {
      segment,
      isWin,
      prizeType: segment.type,
      prizeValue: segment.value,
      reel  // [sym1, sym2, sym3]
    };
  });
}

export async function onReferralAdded(userId) {
  return transaction(async (client) => {
    return spinQueries.incrementPendingRefs(client, userId);
  });
}

export async function getSpinInfo(userId) {
  return transaction(async (client) => {
    return spinQueries.getUserSpinInfo(client, userId);
  });
}

export async function getSpinHistory(userId, limit = 10) {
  return transaction(async (client) => {
    return spinQueries.getUserSpinHistory(client, userId, limit);
  });
}
