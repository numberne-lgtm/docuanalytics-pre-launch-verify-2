"""Best-effort first persisted analysis milestone for verified accounts.

No document data or user identifiers are returned to analytics.
Existing analysis history is not backfilled as a new activation.
"""
async def first_analysis_candidate(db, user):
    if not user.get("email_verified_at") or user.get("email_verified") is not True:
        return False
    if user.get("first_analysis_at"):
        return False
    previous = await db.analyses.find_one({"user_id": user["user_id"]}, {"_id": 1})
    return previous is None

async def claim_first_analysis(db, user_id, now):
    result = await db.users.update_one(
        {"user_id": user_id, "email_verified": True,
         "email_verified_at": {"$exists": True, "$nin": [None, ""]},
         "first_analysis_at": {"$exists": False}},
        {"$set": {"first_analysis_at": now}},
    )
    return result.modified_count == 1
