"""Pydantic request/response schemas."""
from __future__ import annotations

from datetime import date as _date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


# ---------- Auth ----------
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=200)


class OwnerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    username: str
    name: str
    mobile_number: str | None = None
    is_admin: bool = False
    is_active: bool = True


class LoginResponse(BaseModel):
    token: str
    owner: OwnerOut


# ---------- Admin ----------
class AdminOwnerCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=4, max_length=200)
    name: str = Field(..., min_length=1, max_length=120)
    mobile_number: str | None = Field(default=None, max_length=20)
    is_admin: bool = False


class AdminOwnerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    mobile_number: str | None = Field(default=None, max_length=20)
    password: str | None = Field(default=None, min_length=4, max_length=200)
    is_active: bool | None = None
    is_admin: bool | None = None


class AdminOwnerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    username: str
    name: str
    mobile_number: str | None = None
    is_admin: bool
    is_active: bool
    created_at: datetime
    shop_count: int = 0


# ---------- Organizations ----------
class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=180)
    address: str | None = Field(default=None, max_length=300)


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    address: str | None = None
    customer_count: int = 0
    created_at: datetime


# ---------- Customers ----------
class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=180)
    mobile_number: str = Field(..., min_length=6, max_length=20)
    father_name: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=300)


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    organization_id: str
    name: str
    mobile_number: str
    father_name: str | None = None
    address: str | None = None
    balance: Decimal = Decimal("0")


# ---------- Transactions ----------
class TransactionCreate(BaseModel):
    date: _date
    item: str = Field(..., min_length=1, max_length=200)
    quantity: Decimal = Field(default=Decimal("1"), ge=Decimal("0"))
    rate: Decimal = Field(default=Decimal("0"), ge=Decimal("0"))
    amount: Decimal | None = Field(default=None, ge=Decimal("0"))
    paid: Decimal = Field(default=Decimal("0"), ge=Decimal("0"))
    balance: Decimal | None = Field(default=None)
    note: str | None = None


class TransactionUpdate(BaseModel):
    date: _date | None = None
    item: str | None = None
    quantity: Decimal | None = Field(default=None, ge=Decimal("0"))
    rate: Decimal | None = Field(default=None, ge=Decimal("0"))
    amount: Decimal | None = Field(default=None, ge=Decimal("0"))
    paid: Decimal | None = Field(default=None, ge=Decimal("0"))
    balance: Decimal | None = None
    note: str | None = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    customer_id: str
    date: _date
    item: str
    quantity: Decimal
    rate: Decimal
    amount: Decimal
    paid: Decimal
    balance: Decimal
    note: str | None = None
    created_at: datetime
