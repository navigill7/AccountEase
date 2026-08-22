import os

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")

DEMO_USER = "rajesh"
DEMO_PASS = "demo123"


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": DEMO_USER, "password": DEMO_PASS})
    if r.status_code != 200:
        pytest.fail(f"Login failed {r.status_code}: {r.text[:400]}")
    token = r.json().get("token")
    if not token:
        pytest.fail("No token in login response")
    return token


@pytest.fixture(scope="session")
def auth_client(auth_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {auth_token}"})
    return s


@pytest.fixture(scope="session")
def seeded_org(auth_client):
    r = auth_client.get(f"{BASE_URL}/api/organizations")
    assert r.status_code == 200, r.text
    orgs = r.json()
    target = [o for o in orgs if o["name"] == "Sukoon General Store"]
    if not target:
        pytest.fail("Seeded org 'Sukoon General Store' not found")
    return target[0]
