-- Immediate fix: Remap Brad's seeded membership user_id from 'brad' to his Google OAuth user ID.
-- This corrects the mismatch between seeded membership records and better-auth's Google OAuth user ID.
--
-- Brad's Google OAuth user ID: 9aa8cec9-7234-4e84-9485-088e61596e64
-- (His email: brad@arnst.ca)

BEGIN;

-- Update campaign_memberships: replace 'brad' with Google user ID
UPDATE campaign_memberships
SET user_id = '9aa8cec9-7234-4e84-9485-088e61596e64',
    updated_at = datetime('now')
WHERE user_id = 'brad';

-- Update campaign_gm_assignments: replace 'brad' with Google user ID (if any exist)
UPDATE campaign_gm_assignments
SET user_id = '9aa8cec9-7234-4e84-9485-088e61596e64',
    updated_at = datetime('now')
WHERE user_id = 'brad';

COMMIT;

-- Verification: check Brad's memberships now point to correct user_id
SELECT 'membership_verification' AS result_type,
       user_id,
       campaign_slug,
       role,
       created_at,
       updated_at
FROM campaign_memberships
WHERE user_id = '9aa8cec9-7234-4e84-9485-088e61596e64'
ORDER BY campaign_slug;

-- Verification: confirm no orphaned 'brad' memberships remain
SELECT 'orphaned_brad_check' AS result_type,
       COUNT(*) AS orphaned_count
FROM campaign_memberships
WHERE user_id = 'brad';
