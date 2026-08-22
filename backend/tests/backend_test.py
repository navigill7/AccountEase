"""Regression checks for AccountEase authentication and ledger API routes."""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


def test_demo_login_route():
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "rajesh", "password": "demo123"},
        timeout=15,
    )
    assert response.status_code == 200
    assert response.json().get("token")


def test_invalid_login_is_rejected():
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "invalid", "password": "invalid"},
        timeout=15,
    )
    assert response.status_code == 401


def test_organizations_route_returns_shop_data():
    response = requests.get(f"{BASE_URL}/api/organizations", timeout=15)
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_customer_route_returns_customer_data():
    response = requests.get(
        f"{BASE_URL}/api/organizations/1/customers", timeout=15
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_transaction_route_supports_date_filters():
    response = requests.get(
        f"{BASE_URL}/api/customers/1/transactions",
        params={"from": "2024-06-01", "to": "2024-06-30"},
        timeout=15,
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)