"""
AfriHub PII Encryption Utilities
Encrypts sensitive data at rest for compliance with NDPR (Nigeria), 
Kenyan Data Protection Act, and GDPR.
"""
import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Optional


class PIIEn cryptor:
    """
    Encrypts Personally Identifiable Information (PII) at application level.
    Ensures sensitive data is never stored in plaintext in PostgreSQL.
    """
    
    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize encryptor with key from environment or generate new one.
        
        IMPORTANT: Store encryption_key securely in environment variables.
        Never commit this key to version control.
        """
        self.encryption_key = encryption_key or os.getenv("AFRIHUB_ENCRYPTION_KEY")
        
        if not self.encryption_key:
            # Generate a new key for development only
            self.encryption_key = self._generate_key()
            print("⚠️  WARNING: Using auto-generated encryption key. Set AFRIHUB_ENCRYPTION_KEY in production!")
        
        self.fernet = Fernet(self.encryption_key.encode())
    
    def _generate_key(self) -> str:
        """Generate a new Fernet key."""
        return Fernet.generate_key().decode()
    
    def encrypt_phone(self, phone_number: str) -> str:
        """
        Encrypt phone number for storage.
        Example: "+237671234567" -> encrypted string
        """
        if not phone_number:
            return ""
        
        encrypted = self.fernet.encrypt(phone_number.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    
    def decrypt_phone(self, encrypted_phone: str) -> str:
        """
        Decrypt phone number for display or SMS sending.
        Only call this when absolutely necessary (e.g., sending OTP).
        """
        if not encrypted_phone:
            return ""
        
        try:
            decoded = base64.urlsafe_b64decode(encrypted_phone.encode())
            decrypted = self.fernet.decrypt(decoded)
            return decrypted.decode()
        except Exception as e:
            raise ValueError(f"Failed to decrypt phone number: {str(e)}")
    
    def encrypt_bank_details(self, account_number: str, bank_code: str) -> dict:
        """
        Encrypt bank account details as a combined payload.
        Returns encrypted dictionary for JSONB storage.
        """
        payload = f"{account_number}:{bank_code}"
        encrypted = self.fernet.encrypt(payload.encode())
        return {
            "encrypted_data": base64.urlsafe_b64encode(encrypted).decode(),
            "version": "1.0"
        }
    
    def decrypt_bank_details(self, encrypted_data: dict) -> dict:
        """
        Decrypt bank details from JSONB storage.
        Returns dict with account_number and bank_code.
        """
        try:
            encoded = encrypted_data["encrypted_data"]
            decoded = base64.urlsafe_b64decode(encoded.encode())
            decrypted = self.fernet.decrypt(decoded).decode()
            
            account_number, bank_code = decrypted.split(":")
            return {
                "account_number": account_number,
                "bank_code": bank_code
            }
        except Exception as e:
            raise ValueError(f"Failed to decrypt bank details: {str(e)}")
    
    def hash_for_search(self, value: str) -> str:
        """
        Create a deterministic hash for searchable encrypted fields.
        Useful for exact-match lookups without decryption.
        
        Note: This is NOT secure against rainbow tables. Use salted hashes
        in production with user-specific salts.
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"afrihub_search_salt_v1",  # Replace with env-based salt
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(value.encode()))
        return key.decode()


# Global instance for application-wide use
pii_encryptor = PIIEn cryptor()


def encrypt_phone_field(phone: str) -> str:
    """Helper function for model field encryption."""
    return pii_encryptor.encrypt_phone(phone)


def decrypt_phone_field(encrypted_phone: str) -> str:
    """Helper function for model field decryption."""
    return pii_encryptor.decrypt_phone(encrypted_phone)
