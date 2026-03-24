"""Modelos SQLAlchemy para AutoChat AI."""

import uuid
from datetime import datetime, date

from sqlalchemy import (
    Boolean, Column, DateTime, Date, ForeignKey, Integer, String, Text, JSON,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    allowed_domains = Column(ARRAY(String), default=[])
    config = Column(JSON, default={})
    inventory_api_config = Column(JSON, default={})
    billing_plan = Column(String(50), default="trial")
    billing_status = Column(String(50), default="active")
    monthly_message_limit = Column(Integer, default=1000)
    messages_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    conversations = relationship("Conversation", back_populates="tenant", cascade="all, delete-orphan")
    leads = relationship("Lead", back_populates="tenant", cascade="all, delete-orphan")
    usage_metrics = relationship("UsageMetric", back_populates="tenant", cascade="all, delete-orphan")


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    role = Column(String(50), default="admin")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String(255), nullable=False)
    status = Column(String(50), default="active")
    page_context = Column(JSON, default={})
    messages_count = Column(Integer, default=0)
    lead_captured = Column(Boolean, default=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    last_message_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="conversations")
    leads = relationship("Lead", back_populates="conversation")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"), nullable=True)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    postal_code = Column(String(20), nullable=True)
    financing_needed = Column(Boolean, nullable=True)
    vehicle_interest_id = Column(String(100), nullable=True)
    interest_type = Column(String(50), default="general")
    notes = Column(Text, nullable=True)
    status = Column(String(50), default="new")
    created_at = Column(DateTime, default=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="leads")
    conversation = relationship("Conversation", back_populates="leads")


class UsageMetric(Base):
    __tablename__ = "usage_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, default=date.today, nullable=False)
    total_conversations = Column(Integer, default=0)
    total_messages = Column(Integer, default=0)
    total_leads = Column(Integer, default=0)
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("tenant_id", "date"),)

    tenant = relationship("Tenant", back_populates="usage_metrics")
