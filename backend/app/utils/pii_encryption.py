"""
AfriHub PII Encryption Utilities
--------------------------------
Encrypts sensitive data (phone numbers, bank details) at rest for compliance with:
- NDPR (Nigeria Data Protection Regulation)
- Kenya Data Protection Act
- GDPR (for EU users)

Uses Fernet symmetric encryption with key rotation support.
"""

import os
import base64
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class PIIEnCryptor:
    """Handles encryption/decryption of PII fields"""
    
    def __init__(self, encryption_key: Optional[str] = None, salt: Optional[bytes] = None):
        """
        Initialize with encryption key or derive from master secret
        
        Args:
            encryption_key: Base64-encoded Fernet key (32 bytes)
            salt: Salt for key derivation (if using master secret)
        """
        if encryption_key:
            self.fernet = Fernet(encryption_key.encode())
        else:
            # Derive key from environment variable
            master_secret = os.getenv("ENCRYPTION_MASTER_SECRET", "default-dev-secret-change-in-prod")
            salt = salt or b"afrhub_salt_v1_fixed"  # In prod, store salt separately
            
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100_000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(master_secret.encode()))
            self.fernet = Fernet(key)
    
    def encrypt(self, plaintext: str) -> str:
        """Encrypt plaintext and return base64-encoded ciphertext"""
        if not plaintext:
            return ""
        
        encrypted = self.fernet.encrypt(plaintext.encode('utf-8'))
        return base64.urlsafe_b64encode(encrypted).decode('utf-8')
    
    def decrypt(self, ciphertext: str) -> str:
        """Decrypt base64-encoded ciphertext and return plaintext"""
        if not ciphertext:
            return ""
        
        try:
            decoded = base64.urlsafe_b64decode(ciphertext.encode('utf-8'))
            decrypted = self.fernet.decrypt(decoded)
            return decrypted.decode('utf-8')
        except Exception as e:
            # Log decryption failures for security monitoring
            print(f"⚠️  Decryption failed: {e}")
            return ""  # Return empty on failure (don't expose partial data)
    
    def encrypt_phone(self, phone: str) -> str:
        """Encrypt phone number with format validation"""
        # Remove common formatting characters
        cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
        return self.encrypt(cleaned)
    
    def decrypt_phone(self, encrypted_phone: str) -> str:
        """Decrypt phone number"""
        return self.decrypt(encrypted_phone)
    
    def encrypt_bank_details(self, account_number: str, bank_code: str) -> dict:
        """Encrypt bank account details"""
        return {
            "account_number": self.encrypt(account_number),
            "bank_code": self.encrypt(bank_code)
        }
    
    def decrypt_bank_details(self, encrypted_data: dict) -> dict:
        """Decrypt bank account details"""
        return {
            "account_number": self.decrypt(encrypted_data.get("account_number", "")),
            "bank_code": self.decrypt(encrypted_data.get("bank_code", ""))
        }
    
    def hash_for_search(self, value: str) -> str:
        """
        Create deterministic hash for searching encrypted fields
        Use this when you need to search without decrypting all records
        
        Note: This is NOT secure against rainbow tables - use with salt per tenant
        """
        import hashlib
        salt = os.getenv("SEARCH_SALT", "afrhub_search_salt")
        hashed = hashlib.sha256(f"{salt}{value}".encode()).hexdigest()
        return hashed


# Global instance (lazy initialization)
_encryptor: Optional[PIIEnCryptor] = None


def get_encryptor() -> PIIEnCryptor:
    """Get or create global encryptor instance"""
    global _encryptor
    if _encryptor is None:
        _encryptor = PIIEnCryptor()
    return _encryptor


# SQLAlchemy TypeDecorator for automatic encryption
from sqlalchemy.types import String


class EncryptedString(String):
    """SQLAlchemy type that auto-encrypts on write and decrypts on read"""
    
    def __init__(self, length=255, **kwargs):
        super().__init__(length=length, **kwargs)
        self._encryptor = get_encryptor()
    
    def process_bind_param(self, value, dialect):
        """Encrypt before storing in database"""
        if value is None:
            return None
        return self._encryptor.encrypt(str(value))
    
    def process_result_value(self, value, dialect):
        """Decrypt after reading from database"""
        if value is None:
            return None
        return self._encryptor.decrypt(str(value))


# Example model usage
"""
from sqlalchemy import Column
from app.db import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID, primary_key=True)
    # Phone number automatically encrypted/decrypted
    phone_encrypted = Column(EncryptedString(50))
    # Or manual encryption
    bank_account = Column(String(255))  # Store encrypted string manually
    
    @property
    def phone(self):
        return get_encryptor().decrypt(self.phone_encrypted)
    
    @phone.setter
    def phone(self, value):
        self.phone_encrypted = get_encryptor().encrypt_phone(value)
"""


# Utility functions for API responses
def mask_phone(phone: str, visible_chars: int = 3) -> str:
    """Mask phone number for display (e.g., +237XXX...123)"""
    if len(phone) <= visible_chars * 2:
        return "*" * len(phone)
    
    start = phone[:visible_chars]
    end = phone[-visible_chars:]
    middle = "*" * (len(phone) - visible_chars * 2)
    return f"{start}{middle}{end}"


def should_show_full_pii(user_role: str, owner_id: str, current_user_id: str) -> bool:
    """Determine if current user should see full PII"""
    # Admin roles can see all
    if user_role in ["superadmin", "support_admin"]:
        return True
    
    # Owners can see their own
    if owner_id == current_user_id:
        return True
    
    # Verified business partners (B2B) might see limited info
    # Implement based on business logic
    
    return False
