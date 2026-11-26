"""Pure, fail-closed GA4 purchase payloads from provider-confirmed transactions."""
import hashlib
import re
from decimal import Decimal, InvalidOperation

def _payload(provider, transaction, package_id, currency, amount):
    if not isinstance(transaction, str) or not transaction or not isinstance(package_id, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,100}", package_id):
        return None
    if not isinstance(currency, str) or currency.upper() != "EUR":
        return None
    try:
        value = Decimal(str(amount))
        if not value.is_finite() or value <= 0 or value != value.quantize(Decimal("0.01")):
            return None
        value = float(value)
        if not 0 < value < 1000000:
            return None
    except (InvalidOperation, ValueError, OverflowError, TypeError):
        return None
    # Never forward the provider checkout ID or any customer data to analytics.
    tx = "da_" + hashlib.sha256((provider + ":" + transaction).encode()).hexdigest()
    return {"transaction_id": tx, "value": value, "currency": "EUR",
            "items": [{"item_id": package_id, "price": value, "quantity": 1}]}

def stripe_purchase(session, record):
    if not session or not record or session.get("livemode") is not True or session.get("payment_status") != "paid":
        return None
    if session.get("id") != record.get("session_id"):
        return None
    cents = session.get("amount_total")
    if type(cents) is not int or cents <= 0:
        return None
    return _payload("stripe", session.get("id"), record.get("package_id"),
                    session.get("currency"), Decimal(cents) / 100)

def paypal_purchase(order, record, mode):
    if mode != "live" or not order or not record or order.get("status") != "COMPLETED" or order.get("id") != record.get("session_id"):
        return None
    units = order.get("purchase_units", [])
    if len(units) != 1:
        return None
    unit = units[0]
    captures = unit.get("payments", {}).get("captures", [])
    if len(captures) != 1 or captures[0].get("status") != "COMPLETED":
        return None
    capture = captures[0]
    if not capture.get("id"):
        return None
    amount = capture.get("amount", {})
    return _payload("paypal", capture.get("id"), record.get("package_id"),
                    amount.get("currency_code"), amount.get("value"))
