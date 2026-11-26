-- Sprint 4 Sales and payment balance regression tests.
-- Run against an authorized non-production database after migrations and seed.
-- The transaction is rolled back; the test does not alter persistent records.

BEGIN;

DROP TABLE IF EXISTS pg_temp._s4_results;
CREATE TEMP TABLE pg_temp._s4_results (
    id integer PRIMARY KEY,
    name text NOT NULL,
    ok boolean NOT NULL,
    detail text
);

CREATE OR REPLACE FUNCTION pg_temp.check(p_id integer, p_name text, p_ok boolean, p_detail text)
RETURNS void LANGUAGE sql AS $$
    INSERT INTO pg_temp._s4_results (id, name, ok, detail)
    VALUES (p_id, p_name, p_ok, p_detail)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, ok=EXCLUDED.ok, detail=EXCLUDED.detail;
$$;

INSERT INTO auth.users (id, email) VALUES
  ('eeeeeeee-0000-4000-8000-000000000004', 's4-admin@hope.example')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_user (id, email, first_name, last_name, role_id, account_status, is_blocked)
SELECT 'eeeeeeee-0000-4000-8000-000000000004', 's4-admin@hope.example',
       'Sprint', 'Admin', r.role_id, 'active', false
FROM public.app_role AS r
WHERE r.role_code = 'superadmin'
ON CONFLICT (id) DO UPDATE
SET role_id=EXCLUDED.role_id, account_status='active', is_blocked=false;

SET LOCAL request.jwt.claims =
  '{"sub":"eeeeeeee-0000-4000-8000-000000000004","email":"s4-admin@hope.example","role":"authenticated"}';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_prodcode text;
    v_effdate date;
    v_total numeric;
BEGIN
    SELECT ph.prodcode, ph.effdate
    INTO v_prodcode, v_effdate
    FROM public.pricehist AS ph
    JOIN public.product AS p ON p.prodcode = ph.prodcode
    WHERE NOT ph.is_deleted AND NOT p.is_deleted
    ORDER BY ph.effdate
    LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active historical product price is available for this test.';
    END IF;

    INSERT INTO public.sales (transno, salesdate, custno, empno)
    VALUES ('S4TST01', v_effdate, 'C0001', '00005');
    INSERT INTO public.salesdetail (transno, prodcode, quantity)
    VALUES ('S4TST01', v_prodcode, 1);
    SELECT total_amount
    INTO v_total
    FROM public.sales_balance
    WHERE transno = 'S4TST01';
    PERFORM pg_temp.check(1, 'Historical price is applied to sale total', v_total > 0,
      'A line item with an effective price should contribute to the total.');

    INSERT INTO public.payment (orno, paydate, amount, transno)
    VALUES ('S4PAY001', v_effdate, v_total, 'S4TST01');

    BEGIN
        INSERT INTO public.payment (orno, paydate, amount, transno)
        VALUES ('S4PAY002', v_effdate, 0.01, 'S4TST01');
        RAISE EXCEPTION 'Expected the overpayment guard to reject the payment.';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
    PERFORM pg_temp.check(2, 'Payment total cannot exceed sale total',
      NOT EXISTS (SELECT 1 FROM public.payment WHERE orno='S4PAY002'),
      'An additional payment above the sale total must be rejected.');

    BEGIN
        UPDATE public.salesdetail
        SET quantity = 0.5
        WHERE transno='S4TST01' AND prodcode=v_prodcode;
        RAISE EXCEPTION 'Expected line-item reduction to be rejected while payments exceed it.';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
    PERFORM pg_temp.check(3, 'Line total cannot be reduced below active payments',
      (SELECT quantity = 1 FROM public.salesdetail WHERE transno='S4TST01' AND prodcode=v_prodcode),
      'The detail update should roll back when it would leave payments above total.');

    UPDATE public.payment SET is_deleted=true WHERE orno='S4PAY001';
    INSERT INTO public.payment (orno, paydate, amount, transno)
    VALUES ('S4PAY002', v_effdate, v_total, 'S4TST01');
    BEGIN
        UPDATE public.payment SET is_deleted=false WHERE orno='S4PAY001';
        RAISE EXCEPTION 'Expected payment restore to be rejected when it would overpay.';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
    PERFORM pg_temp.check(4, 'Restoring a payment respects the outstanding balance',
      (SELECT is_deleted FROM public.payment WHERE orno='S4PAY001'),
      'Restoring a payment must not exceed the sale total.');

    BEGIN
        INSERT INTO public.sales (transno, salesdate, custno, empno)
        VALUES ('S4TST02', DATE '1900-01-01', 'C0001', '00005');
        INSERT INTO public.salesdetail (transno, prodcode, quantity)
        VALUES ('S4TST02', v_prodcode, 1);
        RAISE EXCEPTION 'Expected a missing as-of price to be rejected.';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
    PERFORM pg_temp.check(5, 'Line item requires price effective on sale date',
      NOT EXISTS (SELECT 1 FROM public.sales WHERE transno='S4TST02'),
      'A product without an effective historical price cannot be added.');
END $$;

RESET ROLE;

SELECT id, name, ok, detail FROM pg_temp._s4_results ORDER BY id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_temp._s4_results WHERE NOT ok) THEN
    RAISE EXCEPTION 'Sprint 4 Sales and payment tests failed.';
  END IF;
END $$;

ROLLBACK;
