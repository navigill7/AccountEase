"""AccountEase FastAPI backend.

Endpoints (all prefixed with /api):
- POST   /auth/login
- GET    /auth/me
- GET    /organizations              (search by ?q=)
- POST   /organizations
- GET    /organizations/{org_id}/customers   (search by ?q=)
- POST   /organizations/{org_id}/customers
- DELETE /customers/{customer_id}
- GET    /customers/{customer_id}
- GET    /customers/{customer_id}/transactions?from=&to=
- POST   /customers/{customer_id}/transactions
- PATCH  /transactions/{transaction_id}
- DELETE /transactions/{transaction_id}
"""
from __future__ import annotations

import logging
import os
from datetime import date
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import create_access_token, get_current_owner, hash_password, verify_password
from database import AsyncSessionLocal, engine, get_session
from models import Base, Customer, Organization, Owner, Transaction
from schemas import (
    CustomerCreate,
    CustomerOut,
    LoginRequest,
    LoginResponse,
    OrganizationCreate,
    OrganizationOut,
    OwnerOut,
    TransactionCreate,
    TransactionOut,
    TransactionUpdate,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("accountease")

app = FastAPI(title="AccountEase API", version="1.0.0")
api = APIRouter(prefix="/api")


# ------------------------------------------------------------------ startup ---
@app.on_event("startup")
async def _startup() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await _seed_demo(session)


async def _seed_demo(session: AsyncSession) -> None:
    username = os.environ.get("DEMO_USERNAME", "rajesh")
    password = os.environ.get("DEMO_PASSWORD", "demo123")

    result = await session.execute(select(Owner).where(Owner.username == username))
    owner = result.scalar_one_or_none()
    if owner is None:
        owner = Owner(username=username, password_hash=hash_password(password), name="Rajesh", mobile_number="9876543210")
        session.add(owner)
        await session.flush()

        shops_seed = [
            ("Sukoon General Store", "12 Market Road, Jaipur"),
            ("Narmada Kirana", "Near Bus Stand, Kota"),
            ("Asha Home Needs", "Station Colony, Ajmer"),
        ]
        first_shop_id: str | None = None
        for name, addr in shops_seed:
            org = Organization(name=name, address=addr, owner_id=owner.id)
            session.add(org)
            await session.flush()
            if first_shop_id is None:
                first_shop_id = org.id

        cust_seed = [
            ("Aarav Sharma", "9876543210", "Rakesh Sharma", "Shastri Nagar, Jaipur"),
            ("Meera Joshi", "9829011842", "Vijay Joshi", "Civil Lines, Jaipur"),
            ("Kabir Khan", "9799466218", "Salim Khan", "Sanganer, Jaipur"),
            ("Nisha Verma", "9812377704", "Mohan Verma", "Malviya Nagar, Jaipur"),
        ]
        for cname, mobile, father, address in cust_seed:
            cust = Customer(
                organization_id=first_shop_id,
                name=cname,
                mobile_number=mobile,
                father_name=father,
                address=address,
            )
            session.add(cust)
            await session.flush()
            if cname == "Aarav Sharma":
                session.add(
                    Transaction(
                        customer_id=cust.id,
                        date=date(2024, 6, 2),
                        item="Household supplies",
                        quantity=Decimal("6"),
                        rate=Decimal("420"),
                        amount=Decimal("2520"),
                        balance=Decimal("9640"),
                    )
                )
                session.add(
                    Transaction(
                        customer_id=cust.id,
                        date=date(2024, 6, 18),
                        item="Monthly groceries",
                        quantity=Decimal("1"),
                        rate=Decimal("2840"),
                        amount=Decimal("2840"),
                        balance=Decimal("12480"),
                    )
                )
        await session.commit()
        logger.info("Seeded demo owner '%s'", username)
    else:
        # Keep password in sync with env
        if not verify_password(password, owner.password_hash):
            owner.password_hash = hash_password(password)
            await session.commit()


# ---------------------------------------------------------------- healthcheck ---
@api.get("/")
async def root() -> dict:
    return {"service": "AccountEase", "status": "ok"}


# ------------------------------------------------------------------- auth ---
@api.post("/auth/login", response_model=LoginResponse)
async def login(payload: LoginRequest, session: AsyncSession = Depends(get_session)) -> LoginResponse:
    result = await session.execute(select(Owner).where(Owner.username == payload.username.strip().lower()))
    owner = result.scalar_one_or_none()
    if owner is None:
        # Also try case-sensitive as fallback (existing rows may not be lowercased)
        result = await session.execute(select(Owner).where(Owner.username == payload.username.strip()))
        owner = result.scalar_one_or_none()
    if owner is None or not verify_password(payload.password, owner.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_access_token(owner.id, owner.username)
    return LoginResponse(token=token, owner=OwnerOut.model_validate(owner))


@api.get("/auth/me", response_model=OwnerOut)
async def me(owner: Owner = Depends(get_current_owner)) -> OwnerOut:
    return OwnerOut.model_validate(owner)


# --------------------------------------------------------- organizations ---
async def _org_or_404(session: AsyncSession, org_id: str, owner_id: str) -> Organization:
    result = await session.execute(select(Organization).where(Organization.id == org_id, Organization.owner_id == owner_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@api.get("/organizations", response_model=list[OrganizationOut])
async def list_organizations(
    q: str | None = Query(default=None),
    owner: Owner = Depends(get_current_owner),
    session: AsyncSession = Depends(get_session),
) -> list[OrganizationOut]:
    stmt = (
        select(
            Organization,
            func.count(Customer.id).label("customer_count"),
        )
        .outerjoin(Customer, Customer.organization_id == Organization.id)
        .where(Organization.owner_id == owner.id)
        .group_by(Organization.id)
        .order_by(Organization.created_at.desc())
    )
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(func.lower(Organization.name).like(like))
    rows = (await session.execute(stmt)).all()
    return [
        OrganizationOut(
            id=org.id,
            name=org.name,
            address=org.address,
            customer_count=int(count or 0),
            created_at=org.created_at,
        )
        for org, count in rows
    ]


@api.post("/organizations", response_model=OrganizationOut, status_code=201)
async def create_organization(
    payload: OrganizationCreate,
    owner: Owner = Depends(get_current_owner),
    session: AsyncSession = Depends(get_session),
) -> OrganizationOut:
    org = Organization(name=payload.name.strip(), address=(payload.address or None), owner_id=owner.id)
    session.add(org)
    await session.commit()
    await session.refresh(org)
    return OrganizationOut(id=org.id, name=org.name, address=org.address, customer_count=0, created_at=org.created_at)


# ------------------------------------------------------------- customers ---
async def _customer_or_404(session: AsyncSession, customer_id: str, owner_id: str) -> Customer:
    stmt = (
        select(Customer)
        .join(Organization, Customer.organization_id == Organization.id)
        .where(Customer.id == customer_id, Organization.owner_id == owner_id)
    )
    result = await session.execute(stmt)
    cust = result.scalar_one_or_none()
    if cust is None:
        raise HTTPException(status_code=404, detail="Customer not found")
    return cust


async def _customer_balance(session: AsyncSession, customer_id: str) -> Decimal:
    stmt = (
        select(Transaction.balance)
        .where(Transaction.customer_id == customer_id)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    val = result.scalar_one_or_none()
    return Decimal(val) if val is not None else Decimal("0")


@api.get("/organizations/{org_id}/customers", response_model=list[CustomerOut])
async def list_customers(
    org_id: str,
    q: str | None = Query(default=None),
    owner: Owner = Depends(get_current_owner),
    session: AsyncSession = Depends(get_session),
) -> list[CustomerOut]:
    await _org_or_404(session, org_id, owner.id)
    stmt = select(Customer).where(Customer.organization_id == org_id).order_by(Customer.created_at.desc())
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(func.lower(Customer.name).like(like) | Customer.mobile_number.like(f"%{q.strip()}%"))
    customers = (await session.execute(stmt)).scalars().all()
    if not customers:
        return []
    # One-shot latest-balance-per-customer using DISTINCT ON
    cust_ids = [c.id for c in customers]
    from sqlalchemy import literal_column
    bal_stmt = (
        select(Transaction.customer_id, Transaction.balance)
        .where(Transaction.customer_id.in_(cust_ids))
        .order_by(Transaction.customer_id, Transaction.date.desc(), Transaction.created_at.desc())
        .distinct(Transaction.customer_id)
    )
    balances: dict[str, Decimal] = {
        cid: Decimal(bal) for cid, bal in (await session.execute(bal_stmt)).all()
    }
    return [
        CustomerOut(
            id=c.id,
            organization_id=c.organization_id,
            name=c.name,
            mobile_number=c.mobile_number,
            father_name=c.father_name,
            address=c.address,
            balance=balances.get(c.id, Decimal("0")),
        )
        for c in customers
    ]


@api.post("/organizations/{org_id}/customers", response_model=CustomerOut, status_code=201)
async def create_customer(
    org_id: str,
    payload: CustomerCreate,
    owner: Owner = Depends(get_current_owner),
    session: AsyncSession = Depends(get_session),
) -> CustomerOut:
    await _org_or_404(session, org_id, owner.id)
    cust = Customer(
        organization_id=org_id,
        name=payload.name.strip(),
        mobile_number=payload.mobile_number.strip(),
        father_name=(payload.father_name or None),
        address=(payload.address or None),
    )
    session.add(cust)
    await session.commit()
    await session.refresh(cust)
    return CustomerOut(
        id=cust.id,
        organization_id=cust.organization_id,
        name=cust.name,
        mobile_number=cust.mobile_number,
        father_name=cust.father_name,
        address=cust.address,
        balance=Decimal("0"),
    )


@api.get("/customers/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: str,
    owner: Owner = Depends(get_current_owner),
    session: AsyncSession = Depends(get_session),
) -> CustomerOut:
    cust = await _customer_or_404(session, customer_id, owner.id)
    bal = await _customer_balance(session, cust.id)
    return CustomerOut(
        id=cust.id,
        organization_id=cust.organization_id,
        name=cust.name,
        mobile_number=cust.mobile_number,
        father_name=cust.father_name,
        address=cust.address,
        balance=bal,
    )


@api.delete("/customers/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: str,
    owner: Owner = Depends(get_current_owner),
    session: AsyncSession = Depends(get_session),
):
    cust = await _customer_or_404(session, customer_id, owner.id)
    await session.delete(cust)
    await session.commit()


# ---------------------------------------------------------- transactions ---
@api.get("/customers/{customer_id}/transactions", response_model=list[TransactionOut])
async def list_transactions(
    customer_id: str,
    from_: date | None = Query(default=None, alias="from"),
    to: date | None = Query(default=None),
    owner: Owner = Depends(get_current_owner),
    session: AsyncSession = Depends(get_session),
) -> list[TransactionOut]:
    await _customer_or_404(session, customer_id, owner.id)
    stmt = select(Transaction).where(Transaction.customer_id == customer_id).order_by(
        Transaction.date.desc(), Transaction.created_at.desc()
    )
    if from_:
        stmt = stmt.where(Transaction.date >= from_)
    if to:
        stmt = stmt.where(Transaction.date <= to)
    rows = (await session.execute(stmt)).scalars().all()
    return [TransactionOut.model_validate(r) for r in rows]


@api.post("/customers/{customer_id}/transactions", response_model=TransactionOut, status_code=201)
async def create_transaction(
    customer_id: str,
    payload: TransactionCreate,
    owner: Owner = Depends(get_current_owner),
    session: AsyncSession = Depends(get_session),
) -> TransactionOut:
    await _customer_or_404(session, customer_id, owner.id)
    tx = Transaction(customer_id=customer_id, **payload.model_dump())
    session.add(tx)
    await session.commit()
    await session.refresh(tx)
    return TransactionOut.model_validate(tx)


async def _tx_or_404(session: AsyncSession, tx_id: str, owner_id: str) -> Transaction:
    stmt = (
        select(Transaction)
        .join(Customer, Customer.id == Transaction.customer_id)
        .join(Organization, Organization.id == Customer.organization_id)
        .where(Transaction.id == tx_id, Organization.owner_id == owner_id)
    )
    tx = (await session.execute(stmt)).scalar_one_or_none()
    if tx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@api.patch("/transactions/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    owner: Owner = Depends(get_current_owner),
    session: AsyncSession = Depends(get_session),
) -> TransactionOut:
    tx = await _tx_or_404(session, transaction_id, owner.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    await session.commit()
    await session.refresh(tx)
    return TransactionOut.model_validate(tx)


@api.delete("/transactions/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: str,
    owner: Owner = Depends(get_current_owner),
    session: AsyncSession = Depends(get_session),
):
    tx = await _tx_or_404(session, transaction_id, owner.id)
    await session.delete(tx)
    await session.commit()


# ------------------------------------------------------------- app setup ---
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
