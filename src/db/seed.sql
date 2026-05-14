-- ============================================================
-- TezPul Mock Seed Data
-- Ishlatish: psql $DATABASE_URL -f src/db/seed.sql
-- ============================================================

BEGIN;

-- Oldingi mock ma'lumotlarni tozalash (qayta ishga tushirish uchun)
DELETE FROM spin_results  WHERE user_id  IN (100000001,100000002,100000003,100000004,100000005,100000006);
DELETE FROM referrals     WHERE referrer_id IN (100000001,100000002,100000003,100000004,100000005,100000006)
                           OR referred_id  IN (100000001,100000002,100000003,100000004,100000005,100000006);
DELETE FROM payments      WHERE user_id  IN (100000001,100000002,100000003,100000004,100000005,100000006);
DELETE FROM user_states   WHERE telegram_id IN (100000001,100000002,100000003,100000004,100000005,100000006);
DELETE FROM users         WHERE telegram_id IN (100000001,100000002,100000003,100000004,100000005,100000006);
DELETE FROM campaigns     WHERE id IN (99);

-- ============================================================
-- 1. CAMPAIGN
-- ============================================================
INSERT INTO campaigns (id, name, channel_id, channel_username, reward_amount, level2_reward_amount, is_active)
VALUES (99, 'Mock Kampaniya', -1001234567890, 'tezpul_test', 5000, 2000, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. USERS
--   Daraja:
--     user1 (asos)
--       ├─ user2 (user1 taklif qilgan)
--       │    ├─ user4 (user2 taklif qilgan)
--       │    └─ user5 (user2 taklif qilgan)
--       └─ user3 (user1 taklif qilgan)
--            └─ user6 (user3 taklif qilgan)
-- ============================================================
INSERT INTO users (telegram_id, username, first_name, last_name, phone, language, referral_code, referred_by, spin_balance, spin_count, pending_refs)
VALUES
  (100000001, 'ali_mock',     'Ali',     'Karimov',   '+998901234567', 'uz', 'REF-ALI-001',   NULL,      15000, 3, 0),
  (100000002, 'barno_mock',   'Barno',   'Toshmatova', '+998902345678', 'uz', 'REF-BARNO-002', 100000001, 10000, 2, 0),
  (100000003, 'jasur_mock',   'Jasur',   'Nazarov',   '+998903456789', 'ru', 'REF-JASUR-003', 100000001,  5000, 1, 1),
  (100000004, 'dilnoza_mock', 'Dilnoza', 'Yusupova',  '+998904567890', 'uz', 'REF-DIL-004',   100000002,  2000, 1, 0),
  (100000005, 'sherzod_mock', 'Sherzod', 'Mirzayev',  NULL,            'uz', 'REF-SHE-005',   100000002,     0, 0, 2),
  (100000006, 'nodira_mock',  'Nodira',  'Rashidova',  '+998906789012', 'uz', 'REF-NOD-006',   100000003,  1000, 0, 0);

-- ============================================================
-- 3. USER STATES
-- ============================================================
INSERT INTO user_states (telegram_id, state)
VALUES
  (100000001, 'IDLE'),
  (100000002, 'IDLE'),
  (100000003, 'IDLE'),
  (100000004, 'IDLE'),
  (100000005, 'IDLE'),
  (100000006, 'IDLE');

-- ============================================================
-- 4. REFERRALS
--   level=1: to'g'ridan-to'g'ri taklif
--   level=2: ikkinchi daraja (user1 → user4/5/6 orqali)
-- ============================================================
INSERT INTO referrals (referrer_id, referred_id, campaign_id, level, reward_amount, is_subscribed, is_rewarded)
VALUES
  -- Ali → Barno (level 1), mukofot olgan
  (100000001, 100000002, 99, 1,  5000, true,  true),
  -- Ali → Jasur (level 1), obuna bo'lgan, lekin mukofot kutilmoqda
  (100000001, 100000003, 99, 1,  5000, true,  false),
  -- Barno → Dilnoza (level 1), mukofot olgan
  (100000002, 100000004, 99, 1,  5000, true,  true),
  -- Barno → Sherzod (level 1), hali obuna bo'lmagan
  (100000002, 100000005, 99, 1,  5000, false, false),
  -- Jasur → Nodira (level 1), obuna bo'lgan
  (100000003, 100000006, 99, 1,  5000, true,  true),

  -- Ali → Dilnoza (level 2, Barno orqali)
  (100000001, 100000004, 99, 2,  2000, true,  true),
  -- Ali → Sherzod (level 2, Barno orqali) — hali tasdiqlanmagan
  (100000001, 100000005, 99, 2,  2000, false, false),
  -- Ali → Nodira (level 2, Jasur orqali)
  (100000001, 100000006, 99, 2,  2000, true,  true)
ON CONFLICT (referrer_id, referred_id, level) DO NOTHING;

-- ============================================================
-- 5. PAYMENTS
-- ============================================================
INSERT INTO payments (user_id, total_amount, paid_amount, status, notes)
VALUES
  -- Ali: to'liq to'langan
  (100000001, 50000, 50000, 'paid',      'Mock to''lov — to''liq'),
  -- Barno: qisman to'langan
  (100000002, 30000, 15000, 'partial',   'Mock to''lov — qisman'),
  -- Jasur: kutilmoqda
  (100000003, 20000,     0, 'pending',   'Mock to''lov — kutilmoqda'),
  -- Dilnoza: to'liq to'langan
  (100000004, 10000, 10000, 'paid',      'Mock to''lov — to''liq'),
  -- Sherzod: bekor qilingan
  (100000005, 15000,     0, 'cancelled', 'Mock to''lov — bekor'),
  -- Nodira: kutilmoqda
  (100000006, 25000,     0, 'pending',   'Mock to''lov — kutilmoqda');

-- ============================================================
-- 6. SPIN RESULTS (Ali va Barno uchun)
-- ============================================================
INSERT INTO spin_results (user_id, segment_id, prize_type, prize_value, is_win, created_at)
VALUES
  (100000001, 1, 'pul',     '5000',  true,  NOW() - INTERVAL '2 days'),
  (100000001, 3, 'pul',     '2000',  true,  NOW() - INTERVAL '1 day'),
  (100000001, 2, 'miss',    '',      false, NOW() - INTERVAL '6 hours'),
  (100000002, 5, 'pul',     '10000', true,  NOW() - INTERVAL '3 days'),
  (100000002, 6, 'miss',    '',      false, NOW() - INTERVAL '1 day'),
  (100000004, 7, 'premium', '1 oy',  true,  NOW() - INTERVAL '12 hours');

COMMIT;

-- Tekshirish
SELECT 'users'     AS table_name, COUNT(*) FROM users     WHERE telegram_id > 100000000 AND telegram_id < 100000007
UNION ALL
SELECT 'referrals',                COUNT(*) FROM referrals  WHERE referrer_id > 100000000 OR referred_id > 100000000
UNION ALL
SELECT 'payments',                 COUNT(*) FROM payments   WHERE user_id > 100000000 AND user_id < 100000007
UNION ALL
SELECT 'spin_results',             COUNT(*) FROM spin_results WHERE user_id > 100000000 AND user_id < 100000007;
