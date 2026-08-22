"""Read-after-write consistency probe for POST /organizations then GET /organizations."""
import time

import requests

from conftest import BASE_URL, DEMO_PASS, DEMO_USER


def test_read_after_write_organizations():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"username": DEMO_USER, "password": DEMO_PASS})
    assert r.status_code == 200
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})

    name = f"TEST_RAW_{int(time.time())}"
    t0 = time.time()
    c = s.post(f"{BASE_URL}/api/organizations", json={"name": name})
    assert c.status_code == 201, c.text
    new_id = c.json()["id"]
    print(f"created id={new_id} in {time.time()-t0:.2f}s")

    delays = []
    found_at = None
    for i in range(15):
        g = s.get(f"{BASE_URL}/api/organizations")
        assert g.status_code == 200
        rows = g.json()
        ids = [o["id"] for o in rows]
        present = new_id in ids
        delays.append((round(time.time() - t0, 2), len(rows), present))
        if present and found_at is None:
            found_at = time.time() - t0
            break
        time.sleep(0.4)

    print("poll results (elapsed, count, present):", delays)
    assert found_at is not None, f"New org never appeared in GET list within polling window: {delays}"
    print(f"appeared after {found_at:.2f}s")
    # read-after-write should be immediate
    assert delays[0][2] is True, f"STALE READ: first GET after POST did not contain new org; appeared only at {found_at:.2f}s"
