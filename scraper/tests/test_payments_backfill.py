"""Перенесення оплат з WayForPay у журнал (scraper/payments_backfill.py)."""
from payments_backfill import product_of, olimp_token, approved, tx_row


def test_product_and_token():
    assert product_of("tok-1791200000000-m", 1) == "plus_monthly"
    assert product_of("tok-1791200000000-h", 549) == "plus_halfyear"
    assert product_of("olimp-d-abc-1", 199) == "olimp_print"
    assert olimp_token("olimp-d-abc-1") == "abc"
    assert olimp_token("olimp-abc-1") == "abc"
    assert olimp_token("tok-1-m") is None


def test_only_approved_sales():
    assert approved({"transactionStatus": "Approved", "transactionType": "SALE"})
    assert not approved({"transactionStatus": "Declined"})
    assert not approved({"transactionStatus": "Approved", "transactionType": "REFUND"})


def test_row_key_matches_callback():
    # Той самий ключ, що в lib/payments.js txKey: номер|processingDate.
    row = tx_row({"orderReference": "tok-1-m", "amount": 1, "processingDate": 1791200000, "transactionStatus": "Approved"},
                 sub={"id": "s1", "telegram_chat_id": 11, "telegram_handle": "@mama"})
    assert row["tx_key"] == "tok-1-m|1791200000"
    assert row["telegram_chat_id"] == "11" and row["source"] == "backfill"
