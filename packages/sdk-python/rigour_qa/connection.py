"""Connection configuration for target systems."""

from typing import Any, Optional

from pydantic import BaseModel, Field, HttpUrl


class Connection(BaseModel):
    """Configuration for connecting to a target system."""

    base_url: str = Field(description="Base URL of the system under test")
    auth_type: Optional[str] = Field(
        None, description="Auth type: bearer, basic, api_key, oauth"
    )
    auth_token: Optional[str] = Field(None, description="Bearer token or API key")
    username: Optional[str] = Field(None, description="Username for basic auth")
    password: Optional[str] = Field(None, description="Password for basic auth")
    headers: dict[str, str] = Field(
        default_factory=dict, description="Default headers for all requests"
    )
    timeout: int = Field(default=30, description="Request timeout in seconds")
    verify_ssl: bool = Field(default=True, description="Verify SSL certificates")
    db_url: Optional[str] = Field(
        None, description="Database URL for DB assertions (optional)"
    )
    proxy: Optional[str] = Field(None, description="HTTP proxy URL (optional)")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Extra metadata")

    model_config = {
        "json_schema_extra": {
            "example": {
                "base_url": "https://api.example.com",
                "auth_type": "bearer",
                "auth_token": "token_xxx",
                "headers": {
                    "User-Agent": "RigourQA/0.1.0"
                },
                "timeout": 30,
                "verify_ssl": True
            }
        }
    }

    def get_auth_header(self) -> Optional[dict[str, str]]:
        """Generate authorization header based on auth configuration."""
        if not self.auth_type:
            return None

        if self.auth_type == "bearer":
            return {"Authorization": f"Bearer {self.auth_token}"}
        elif self.auth_type == "api_key":
            return {"X-API-Key": self.auth_token}
        elif self.auth_type == "basic":
            import base64
            credentials = base64.b64encode(
                f"{self.username}:{self.password}".encode()
            ).decode()
            return {"Authorization": f"Basic {credentials}"}
        return None

    def get_headers(self) -> dict[str, str]:
        """Get all headers including auth."""
        headers = dict(self.headers)
        auth_header = self.get_auth_header()
        if auth_header:
            headers.update(auth_header)
        return headers

    @classmethod
    def from_env(cls) -> "Connection":
        """Create Connection from environment variables."""
        import os
        return cls(
            base_url=os.getenv("TEST_BASE_URL", "http://localhost:8000"),
            auth_type=os.getenv("TEST_AUTH_TYPE"),
            auth_token=os.getenv("TEST_AUTH_TOKEN"),
            username=os.getenv("TEST_USERNAME"),
            password=os.getenv("TEST_PASSWORD"),
            timeout=int(os.getenv("TEST_TIMEOUT", "30")),
            verify_ssl=os.getenv("TEST_VERIFY_SSL", "true").lower() == "true",
            db_url=os.getenv("TEST_DB_URL"),
        )
