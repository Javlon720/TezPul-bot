-- ============================================================
-- Spin berish yordamchi skripti
-- Ishlatish:
--   psql $DATABASE_URL -f src/db/mock/give-spins.sql
--   yoki faqat bir userni yangilash uchun:
--   psql $DATABASE_URL -c "UPDATE users SET spin_count = 5 WHERE telegram_id = YOUR_ID;"
-- ============================================================

-- Barcha foydalanuvchilarning joriy spin holatini ko'rish
SELECT
  telegram_id,
  username,
  first_name,
  spin_count    AS "Spinlar",
  spin_balance  AS "Balans (so'm)",
  pending_refs  AS "Kutayotgan refs"
FROM users
ORDER BY spin_count DESC;

-- Quyidagi buyruqni o'zingizga moslang:
-- UPDATE users SET spin_count = 5 WHERE telegram_id = 1032927546;
