"""AccountEase backend API regression suite."""
import uuid
from datetime import date

import pytest

from conftest import BASE_URL, DEMO_PASS, DEMO_USER


# ------------------------------------------------------------ health / auth ---
class TestHealthAuth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_login_success(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": DEMO_USER, "password": DEMO_PASS})
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["token"], str) and len(d["token"]) > 20
        assert d["owner"]["username"] == DEMO_USER
        assert d["owner"]["name"] == "Rajesh"
        assert "password_hash" not in d["owner"]

    def test_login_bad_password(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": DEMO_USER, "password": "wrong"})
        assert r.status_code == 401
        assert "detail" in r.json()

    def test_login_unknown_user(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": "nobody_xyz", "password": "demo123"})
        assert r.status_code == 401

    def test_login_validation(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": "", "password": ""})
        assert r.status_code == 422

    def test_me_with_token(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200, r.text
        assert r.json()["username"] == DEMO_USER

    def test_me_without_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_bad_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
        assert r.status_code == 401


# ----------------------------------------------------------- organizations ---
class TestOrganizations:
    created = []

    def test_list_requires_auth(self, api_client):
        assert api_client.get(f"{BASE_URL}/api/organizations").status_code == 401

    def test_list_seeded(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/organizations")
        assert r.status_code == 200, r.text
        names = [o["name"] for o in r.json()]
        for expected in ["Sukoon General Store", "Narmada Kirana", "Asha Home Needs"]:
            assert expected in names, f"{expected} missing from {names}"
        sukoon = [o for o in r.json() if o["name"] == "Sukoon General Store"][0]
        assert sukoon["customer_count"] >= 4
        assert "_id" not in sukoon

    def test_create_and_search(self, auth_client):
        name = f"TEST_Shop_{uuid.uuid4().hex[:6]}"
        r = auth_client.post(f"{BASE_URL}/api/organizations", json={"name": name, "address": "TEST addr"})
        assert r.status_code == 201, r.text
        org = r.json()
        assert org["name"] == name
        assert org["address"] == "TEST addr"
        assert org["customer_count"] == 0
        TestOrganizations.created.append(org["id"])

        # search filter
        r2 = auth_client.get(f"{BASE_URL}/api/organizations", params={"q": name[:12]})
        assert r2.status_code == 200
        assert any(o["id"] == org["id"] for o in r2.json())

        # search miss
        r3 = auth_client.get(f"{BASE_URL}/api/organizations", params={"q": "zzz_no_match_zzz"})
        assert r3.status_code == 200 and r3.json() == []

    def test_create_validation(self, auth_client):
        r = auth_client.post(f"{BASE_URL}/api/organizations", json={"name": ""})
        assert r.status_code == 422

    def test_unknown_org_customers_404(self, auth_client):
        r = auth_client.get(f"{BASE_URL}/api/organizations/{uuid.uuid4()}/customers")
        assert r.status_code == 404


# --------------------------------------------------------------- customers ---
class TestCustomers:
    def test_list_seeded_customers(self, auth_client, seeded_org):
        r = auth_client.get(f"{BASE_URL}/api/organizations/{seeded_org['id']}/customers")
        assert r.status_code == 200, r.text
        names = [c["name"] for c in r.json()]
        for n in ["Aarav Sharma", "Meera Joshi", "Kabir Khan", "Nisha Verma"]:
            assert n in names, f"{n} missing from {names}"
        aarav = [c for c in r.json() if c["name"] == "Aarav Sharma"][0]
        assert float(aarav["balance"]) == 12480.0

    def test_search_by_name_and_mobile(self, auth_client, seeded_org):
        oid = seeded_org["id"]
        r = auth_client.get(f"{BASE_URL}/api/organizations/{oid}/customers", params={"q": "meera"})
        assert r.status_code == 200
        assert [c["name"] for c in r.json()] == ["Meera Joshi"]

        r2 = auth_client.get(f"{BASE_URL}/api/organizations/{oid}/customers", params={"q": "9799466218"})
        assert r2.status_code == 200
        assert [c["name"] for c in r2.json()] == ["Kabir Khan"]

    def test_crud_customer(self, auth_client, seeded_org):
        oid = seeded_org["id"]
        payload = {"name": "TEST_Cust", "mobile_number": "9000000001", "father_name": "TEST_Dad", "address": "TEST"}
        r = auth_client.post(f"{BASE_URL}/api/organizations/{oid}/customers", json=payload)
        assert r.status_code == 201, r.text
        cust = r.json()
        assert cust["name"] == payload["name"]
        assert cust["mobile_number"] == payload["mobile_number"]
        assert float(cust["balance"]) == 0.0
        cid = cust["id"]

        # GET verifies persistence
        g = auth_client.get(f"{BASE_URL}/api/customers/{cid}")
        assert g.status_code == 200
        assert g.json()["father_name"] == "TEST_Dad"
        assert g.json()["organization_id"] == oid

        # DELETE + verify removal
        d = auth_client.delete(f"{BASE_URL}/api/customers/{cid}")
        assert d.status_code in (200, 204), d.text
        assert auth_client.get(f"{BASE_URL}/api/customers/{cid}").status_code == 404

    def test_customer_validation(self, auth_client, seeded_org):
        r = auth_client.post(
            f"{BASE_URL}/api/organizations/{seeded_org['id']}/customers",
            json={"name": "TEST_bad", "mobile_number": "123"},
        )
        assert r.status_code == 422

    def test_delete_cascades_transactions(self, auth_client, seeded_org):
        oid = seeded_org["id"]
        c = auth_client.post(
            f"{BASE_URL}/api/organizations/{oid}/customers",
            json={"name": "TEST_Cascade", "mobile_number": "9000000002"},
        )
        assert c.status_code == 201, c.text
        cid = c.json()["id"]
        t = auth_client.post(
            f"{BASE_URL}/api/customers/{cid}/transactions",
            json={"date": "2024-07-01", "item": "TEST item", "quantity": 1, "rate": 100, "amount": 100, "balance": 100},
        )
        assert t.status_code == 201, t.text
        tx_id = t.json()["id"]

        assert auth_client.delete(f"{BASE_URL}/api/customers/{cid}").status_code in (200, 204)
        assert auth_client.get(f"{BASE_URL}/api/customers/{cid}").status_code == 404
        # transaction must be gone too
        assert auth_client.patch(f"{BASE_URL}/api/transactions/{tx_id}", json={"item": "x"}).status_code == 404

    def test_unknown_customer_404(self, auth_client):
        assert auth_client.get(f"{BASE_URL}/api/customers/{uuid.uuid4()}").status_code == 404


# ------------------------------------------------------------ transactions ---
class TestTransactions:
    @pytest.fixture(scope="class")
    def temp_customer(self, auth_client, seeded_org):
        r = auth_client.post(
            f"{BASE_URL}/api/organizations/{seeded_org['id']}/customers",
            json={"name": "TEST_TxCust", "mobile_number": "9000000003"},
        )
        assert r.status_code == 201, r.text
        cid = r.json()["id"]
        yield cid
        auth_client.delete(f"{BASE_URL}/api/customers/{cid}")

    def test_seeded_transactions_newest_first(self, auth_client, seeded_org):
        cs = auth_client.get(f"{BASE_URL}/api/organizations/{seeded_org['id']}/customers", params={"q": "Aarav"})
        cid = cs.json()[0]["id"]
        r = auth_client.get(f"{BASE_URL}/api/customers/{cid}/transactions")
        assert r.status_code == 200, r.text
        rows = r.json()
        assert len(rows) >= 2
        dates = [x["date"] for x in rows]
        assert dates == sorted(dates, reverse=True), f"not newest-first: {dates}"
        assert rows[0]["item"] == "Monthly groceries"
        assert float(rows[0]["balance"]) == 12480.0

    def test_date_filter(self, auth_client, seeded_org):
        cs = auth_client.get(f"{BASE_URL}/api/organizations/{seeded_org['id']}/customers", params={"q": "Aarav"})
        cid = cs.json()[0]["id"]
        r = auth_client.get(
            f"{BASE_URL}/api/customers/{cid}/transactions",
            params={"from": "2024-06-10", "to": "2024-06-30"},
        )
        assert r.status_code == 200, r.text
        items = [x["item"] for x in r.json()]
        assert "Monthly groceries" in items
        assert "Household supplies" not in items

        empty = auth_client.get(
            f"{BASE_URL}/api/customers/{cid}/transactions", params={"from": "2030-01-01", "to": "2030-12-31"}
        )
        assert empty.status_code == 200 and empty.json() == []

    def test_bad_date_filter(self, auth_client, temp_customer):
        r = auth_client.get(f"{BASE_URL}/api/customers/{temp_customer}/transactions", params={"from": "notadate"})
        assert r.status_code == 422

    def test_crud_transaction(self, auth_client, temp_customer):
        cid = temp_customer
        payload = {
            "date": date.today().isoformat(),
            "item": "TEST_Rice",
            "quantity": 2,
            "rate": 50.5,
            "amount": 101,
            "balance": 101,
            "note": "TEST note",
        }
        r = auth_client.post(f"{BASE_URL}/api/customers/{cid}/transactions", json=payload)
        assert r.status_code == 201, r.text
        tx = r.json()
        assert tx["item"] == "TEST_Rice"
        assert float(tx["amount"]) == 101.0
        assert float(tx["rate"]) == 50.5
        assert tx["note"] == "TEST note"
        tx_id = tx["id"]

        # balance derived from latest transaction
        cust = auth_client.get(f"{BASE_URL}/api/customers/{cid}").json()
        assert float(cust["balance"]) == 101.0

        # PATCH partial
        p = auth_client.patch(f"{BASE_URL}/api/transactions/{tx_id}", json={"item": "TEST_Wheat", "balance": 250})
        assert p.status_code == 200, p.text
        assert p.json()["item"] == "TEST_Wheat"
        assert float(p.json()["balance"]) == 250.0
        assert float(p.json()["amount"]) == 101.0  # untouched

        # GET verifies persistence
        rows = auth_client.get(f"{BASE_URL}/api/customers/{cid}/transactions").json()
        found = [x for x in rows if x["id"] == tx_id][0]
        assert found["item"] == "TEST_Wheat"
        assert float(found["balance"]) == 250.0
        assert float(auth_client.get(f"{BASE_URL}/api/customers/{cid}").json()["balance"]) == 250.0

        # DELETE
        d = auth_client.delete(f"{BASE_URL}/api/transactions/{tx_id}")
        assert d.status_code in (200, 204), d.text
        rows2 = auth_client.get(f"{BASE_URL}/api/customers/{cid}/transactions").json()
        assert all(x["id"] != tx_id for x in rows2)

    def test_transaction_validation(self, auth_client, temp_customer):
        r = auth_client.post(
            f"{BASE_URL}/api/customers/{temp_customer}/transactions",
            json={"item": "TEST_missing_fields"},
        )
        assert r.status_code == 422

    def test_unknown_transaction_404(self, auth_client):
        assert auth_client.patch(f"{BASE_URL}/api/transactions/{uuid.uuid4()}", json={"item": "x"}).status_code == 404
        assert auth_client.delete(f"{BASE_URL}/api/transactions/{uuid.uuid4()}").status_code == 404

    def test_transactions_require_auth(self, api_client, temp_customer):
        assert api_client.get(f"{BASE_URL}/api/customers/{temp_customer}/transactions").status_code == 401


# ----------------------------------------------------------- cleanup / misc ---
class TestCleanupOrgs:
    def test_cleanup_created_orgs(self, auth_client):
        """No DELETE /organizations endpoint exists - documents the gap."""
        r = auth_client.get(f"{BASE_URL}/api/organizations", params={"q": "TEST_Shop_"})
        assert r.status_code == 200
        leftovers = [o["name"] for o in r.json()]
        print(f"TEST_ orgs left behind (no delete endpoint): {leftovers}")
