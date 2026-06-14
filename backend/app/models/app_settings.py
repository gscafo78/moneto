from sqlalchemy import Column, Integer, String, Boolean
from app.db.base import Base


class AppSettings(Base):
    """Riga singola (id=1) con le impostazioni globali dell'app."""
    __tablename__ = "app_settings"
    id = Column(Integer, primary_key=True, default=1)
    allow_registration = Column(Boolean, default=False, nullable=False, server_default="false")

    smtp_host = Column(String, nullable=True)
    smtp_port = Column(Integer, nullable=True)
    smtp_user = Column(String, nullable=True)
    smtp_password = Column(String, nullable=True)
    smtp_from = Column(String, nullable=True)
    smtp_tls = Column(Boolean, nullable=True)
