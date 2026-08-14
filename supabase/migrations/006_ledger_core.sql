-- ============================================================
-- Cruxe Migration 006: ledger_apply
-- The single point through which every coin movement passes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ledger_apply(
  p_user_id         UUID,
  p_delta           INT,
  p_reason          coin_reason,
  p_idempotency_key TEXT,
  p_metadata        JSONB   DEFAULT '{}'::JSONB,
  p_allow_negative  BOOLEAN DEFAULT FALSE
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing INT;
  v_balance  INT;
BEGIN
  IF p_delta = 0 THEN
    RAISE EXCEPTION 'delta_must_be_nonzero';
  END IF;

  -- Fast path: this movement already happened.
  SELECT balance_after INTO v_existing
    FROM coin_ledger WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  -- Serialise concurrent movements for this user.
  SELECT coins INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  v_balance := v_balance + p_delta;
  IF v_balance < 0 AND NOT p_allow_negative THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  UPDATE users SET coins = v_balance WHERE id = p_user_id;

  INSERT INTO coin_ledger (user_id, delta, reason, balance_after,
                           idempotency_key, metadata)
  VALUES (p_user_id, p_delta, p_reason, v_balance,
          p_idempotency_key, p_metadata);

  RETURN v_balance;

EXCEPTION
  -- Two callers raced past the fast path with the same key. The losing
  -- transaction rolls back to the start of this block, undoing its UPDATE,
  -- then reports the winner's balance.
  WHEN unique_violation THEN
    SELECT balance_after INTO v_existing
      FROM coin_ledger WHERE idempotency_key = p_idempotency_key;
    RETURN v_existing;
END;
$$;

-- Never callable by clients. Only SECURITY DEFINER functions and service_role.
REVOKE ALL ON FUNCTION public.ledger_apply(UUID, INT, coin_reason, TEXT, JSONB, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
