"""Draft renewal credit primitive; NOT wired to live webhook handlers.

Caller must independently authenticate provider event, verify ownership and paid
renewal (not first activation), resolve credits from trusted subscription data,
and reconcile historical entitlements before enabling a cutover.
"""
import hashlib
from datetime import datetime, timezone

def renewal_update(user_id, provider, payment_id, credits, paid_at, cutover_at):
    """Build a single-document atomic mutation, or refuse unsafe input.

    UTC-aware datetimes required. The cutover must be chosen after reconciliation.
    The durable hash is scoped to the provider payment, not the webhook delivery.
    Never prune these markers while old provider events can be replayed.
    """
    if provider not in ("stripe", "paypal"):
        return None
    if not isinstance(user_id, str) or not user_id or not isinstance(payment_id, str) or not payment_id:
        return None
    if type(credits) is not int or not 0 < credits <= 99999:
        return None
    if not all(isinstance(x, datetime) and x.utcoffset() is not None for x in (paid_at, cutover_at)):
        return None
    if paid_at.astimezone(timezone.utc) < cutover_at.astimezone(timezone.utc):
        return None
    marker = hashlib.sha256((provider + ":" + payment_id).encode()).hexdigest()
    selector = {"user_id": user_id, "billing_renewal_claims": {"$ne": marker}}
    mutation = {"$inc": {"credits": credits}, "$addToSet": {"billing_renewal_claims": marker}}
    return selector, mutation
