-- ============================================================
-- Cruxe Migration 021: a ledger reason for buying a fact
--
-- Alone in its own migration on purpose. Postgres refuses to use a new enum
-- value in the same transaction that adds it, so 022 — which spends with
-- this reason — cannot also declare it. Migrations 014 and 015 were split
-- for exactly this, and the release checklist still carries the note about
-- running them in order.
--
-- Run this, then 022.
-- ============================================================

ALTER TYPE coin_reason ADD VALUE IF NOT EXISTS 'fact_unlock';
