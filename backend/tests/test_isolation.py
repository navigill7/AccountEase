"""Cross-owner data isolation test.

No public signup endpoint exists, so a second owner is inserted directly via the
app's own DB layer, then exercised purely through the public API.
"""
import asyncio
import sys
import uuid

import pytest
import requests
from dotenv import load_dotenv

sys.path.insert(0, "/app/backend")
load_dotenv("/app/backend/.env")

from conftest import BASE_URL, DEMO_PASS, DEMO_USER  # noqa: E402

SECOND_USER = "test_owner2"
SECOND_PASS = "TestPass2!"


def _run(coro_factory):
    """Run a DB coroutine in a dedicated loop and dispose the engine in the same loop."""

    async def _wrapper():
        from database import engine

        try:
            return await coro_factory()
        finally:
            await engine.dispose()

    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_wrapper())
    finally:
        loop.close()


async def _create_owner():
    from auth import hash_password
    from database import AsyncSessionLocal
    from models import Owner
    from sqlalchemy import select

    async with AsyncSessionLocal() as s:
        existing = (await s.execute(select(Owner).where(Owner.username == SECOND_USER))).scalar_one_or_none()
        if existing:
            return existing.id
        o = Owner(username=SECOND_USER, password_hash=hash_password(SECOND_PASS), name="TEST Owner Two", mobile_number="9111111111")
        s.add(o)
        await s.commit()
        return o.id


async def _delete_owner():
    from database import AsyncSessionLocal
    from models import Owner
    from sqlalchemy import select

    async with AsyncSessionLocal() as s:
        o = (await s.execute(select(Owner).where(Owner.username == SECOND_USER))).scalar_one_or_none()
        if o:
            await s.delete(o)
            await s.commit()


@pytest.fixture(scope="module")
def second_owner_token():
    _run(_create_owner)
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": SECOND_USER, "password": SECOND_PASS})
    assert r.status_code == 200, r.text
    yield r.json()["token"]
    _run(_delete_owner)


def test_second_owner_cannot_see_or_touch_first_owners_data(second_owner_token):
    s1 = requests.Session()
    s1.headers.update({"Authorization": f"Bearer {requests.post(f'{BASE_URL}/api/auth/login', json={'username': DEMO_USER, 'password': DEMO_PASS}).json()['token']}"})
    s2 = requests.Session()
    s2.headers.update({"Authorization": f"Bearer {second_owner_token}"})

    orgs1 = s1.get(f"{BASE_URL}/api/organizations").json()
    assert orgs1, "demo owner should have orgs"
    org1 = orgs1[0]

    # owner2 sees an empty list, not owner1's shops
    orgs2 = s2.get(f"{BASE_URL}/api/organizations")
    assert orgs2.status_code == 200
    assert all(o["id"] != org1["id"] for o in orgs2.json()), "LEAK: owner2 can see owner1 organizations"

    # owner2 blocked from owner1's org customers
    assert s2.get(f"{BASE_URL}/api/organizations/{org1['id']}/customers").status_code == 404
    assert s2.post(f"{BASE_URL}/api/organizations/{org1['id']}/customers", json={"name": "TEST_hack", "mobile_number": "9000099999"}).status_code == 404

    # find a customer + transaction owned by owner1
    sukoon = [o for o in orgs1 if o["name"] == "Sukoon General Store"][0]
    custs = s1.get(f"{BASE_URL}/api/organizations/{sukoon['id']}/customers").json()
    aarav = [c for c in custs if c["name"] == "Aarav Sharma"][0]
    txs = s1.get(f"{BASE_URL}/api/customers/{aarav['id']}/transactions").json()
    assert txs

    assert s2.get(f"{BASE_URL}/api/customers/{aarav['id']}").status_code == 404
    assert s2.get(f"{BASE_URL}/api/customers/{aarav['id']}/transactions").status_code == 404
    assert s2.delete(f"{BASE_URL}/api/customers/{aarav['id']}").status_code == 404
    assert s2.patch(f"{BASE_URL}/api/transactions/{txs[0]['id']}", json={"balance": 1}).status_code == 404
    assert s2.delete(f"{BASE_URL}/api/transactions/{txs[0]['id']}").status_code == 404

    # data untouched
    still = s1.get(f"{BASE_URL}/api/customers/{aarav['id']}")
    assert still.status_code == 200
    assert float(still.json()["balance"]) == 12480.0


def test_owner2_token_scoped_to_own_org(second_owner_token):
    s2 = requests.Session()
    s2.headers.update({"Authorization": f"Bearer {second_owner_token}"})
    name = f"TEST_Owner2Shop_{uuid.uuid4().hex[:5]}"
    c = s2.post(f"{BASE_URL}/api/organizations", json={"name": name})
    assert c.status_code == 201, c.text
    oid = c.json()["id"]

    mine = s2.get(f"{BASE_URL}/api/organizations").json()
    assert any(o["id"] == oid for o in mine)

    # demo owner must not see owner2's new shop
    s1 = requests.Session()
    tok = requests.post(f"{BASE_URL}/api/auth/login", json={"username": DEMO_USER, "password": DEMO_PASS}).json()["token"]
    s1.headers.update({"Authorization": f"Bearer {tok}"})
    assert all(o["id"] != oid for o in s1.get(f"{BASE_URL}/api/organizations").json()), "LEAK: owner1 sees owner2's org"
    assert s1.get(f"{BASE_URL}/api/organizations/{oid}/customers").status_code == 404
