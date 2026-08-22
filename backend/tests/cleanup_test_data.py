"""One-off cleanup of TEST_ organizations created during testing (no DELETE /organizations endpoint exists)."""
import asyncio
import sys

sys.path.insert(0, "/app/backend")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")

from sqlalchemy import select  # noqa: E402

from database import AsyncSessionLocal  # noqa: E402
from models import Organization  # noqa: E402


async def main() -> None:
    async with AsyncSessionLocal() as s:
        rows = (await s.execute(select(Organization).where(Organization.name.like("TEST_%")))).scalars().all()
        print(f"deleting {len(rows)} TEST_ orgs: {[r.name for r in rows]}")
        for r in rows:
            await s.delete(r)
        await s.commit()


asyncio.run(main())
