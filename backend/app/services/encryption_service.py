from cryptography.fernet import Fernet
from app.config import settings


class EncryptionService:
    """
    Symmetric encryption for sensitive data (API keys, DB credentials, OAuth tokens).
    Uses Fernet (AES-128-CBC + HMAC-SHA256) — authenticated encryption.
    The key lives ONLY in the environment, never in code or DB.
    """

    def __init__(self) -> None:
        self._fernet = Fernet(settings.FERNET_KEY.encode())

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a string and return a URL-safe base64 token."""
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt a Fernet token and return the original string."""
        return self._fernet.decrypt(ciphertext.encode()).decode()


# Module-level singleton — instantiate once, inject everywhere
encryption_service = EncryptionService()
