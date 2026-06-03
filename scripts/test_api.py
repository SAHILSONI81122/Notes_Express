import urllib.request
import urllib.error
import json
from backend.database.database import AsyncSessionLocal
from backend.models.models import User, RoleEnum
from sqlalchemy.future import select
import asyncio

async def main():
    async with AsyncSessionLocal() as db:
        user_res = await db.execute(select(User).where(User.role == RoleEnum.admin).limit(1))
        admin = user_res.scalars().first()
        from backend.routes.auth import create_access_token
        from datetime import timedelta
        token = create_access_token({"sub": admin.email, "role": admin.role.value, "id": admin.id}, timedelta(minutes=60))
        
        req = urllib.request.Request(f"http://localhost:8000/batches/{admin.batch_id}/members")
        req.add_header("Authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req) as response:
                print("Status:", response.status)
                data = json.loads(response.read().decode())
                print("Length:", len(data))
        except urllib.error.HTTPError as e:
            print("HTTPError:", e.code)
            print("Response:", e.read().decode())

asyncio.run(main())
