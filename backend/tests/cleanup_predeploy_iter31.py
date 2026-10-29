# Cleanup data created by iteration-31 pre-deploy regression (test_predeploy_iter31@example.com only)
import asyncio, os, re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

EMAIL = "test_predeploy_iter31@example.com"


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    u = await db.users.find_one({"email": EMAIL})
    if not u:
        print("user not found"); return
    uid = u["user_id"]
    for col in ["analyses", "reminders", "payment_transactions", "clients", "audits", "referrals"]:
        q = {"user_id": uid} if col != "referrals" else {"$or": [{"inviter": uid}, {"invitee": uid}]}
        r = await db[col].delete_many(q)
        print(col, r.deleted_count)
    print("users", (await db.users.delete_one({"user_id": uid})).deleted_count)
    left = await db.users.count_documents({"email": {"$regex": r"^test_.*@example\.com$"}, "created_at": {"$gte": "2026-10-29"}})
    print("other test_*@example.com users created today (left by suites):", left)

asyncio.run(main())
