"""Tests for Connection module."""

import pytest
from rigour_qa.connection import Connection


def test_connection_basic():
    """Test basic Connection creation."""
    conn = Connection(base_url="https://api.example.com")
    assert conn.base_url == "https://api.example.com"
    assert conn.timeout == 30
    assert conn.verify_ssl is True


def test_connection_with_bearer_auth():
    """Test Connection with bearer token auth."""
    conn = Connection(
        base_url="https://api.example.com",
        auth_type="bearer",
        auth_token="token_xyz"
    )

    auth_header = conn.get_auth_header()
    assert auth_header is not None
    assert auth_header["Authorization"] == "Bearer token_xyz"


def test_connection_with_api_key_auth():
    """Test Connection with API key auth."""
    conn = Connection(
        base_url="https://api.example.com",
        auth_type="api_key",
        auth_token="key_123"
    )

    auth_header = conn.get_auth_header()
    assert auth_header["X-API-Key"] == "key_123"


def test_connection_with_basic_auth():
    """Test Connection with basic auth."""
    conn = Connection(
        base_url="https://api.example.com",
        auth_type="basic",
        username="user",
        password="pass"
    )

    auth_header = conn.get_auth_header()
    assert "Authorization" in auth_header
    assert auth_header["Authorization"].startswith("Basic ")


def test_connection_get_headers():
    """Test getting all headers including auth."""
    conn = Connection(
        base_url="https://api.example.com",
        auth_type="bearer",
        auth_token="token_xyz",
        headers={"User-Agent": "Test/1.0"}
    )

    headers = conn.get_headers()
    assert headers["User-Agent"] == "Test/1.0"
    assert headers["Authorization"] == "Bearer token_xyz"


def test_connection_without_auth():
    """Test Connection without auth."""
    conn = Connection(base_url="https://api.example.com")
    auth_header = conn.get_auth_header()
    assert auth_header is None

    headers = conn.get_headers()
    assert "Authorization" not in headers


def test_connection_with_custom_headers():
    """Test Connection with custom headers."""
    conn = Connection(
        base_url="https://api.example.com",
        headers={
            "User-Agent": "RigourQA/0.1.0",
            "Accept": "application/json"
        }
    )

    assert conn.headers["User-Agent"] == "RigourQA/0.1.0"
    assert conn.headers["Accept"] == "application/json"


def test_connection_with_db_url():
    """Test Connection with database URL."""
    conn = Connection(
        base_url="https://api.example.com",
        db_url="postgresql://localhost/testdb"
    )

    assert conn.db_url == "postgresql://localhost/testdb"


def test_connection_with_proxy():
    """Test Connection with proxy."""
    conn = Connection(
        base_url="https://api.example.com",
        proxy="http://proxy.example.com:8080"
    )

    assert conn.proxy == "http://proxy.example.com:8080"


def test_connection_with_metadata():
    """Test Connection with metadata."""
    conn = Connection(
        base_url="https://api.example.com",
        metadata={"environment": "staging", "region": "us-east-1"}
    )

    assert conn.metadata["environment"] == "staging"
    assert conn.metadata["region"] == "us-east-1"


def test_connection_timeout_configuration():
    """Test Connection timeout."""
    conn = Connection(
        base_url="https://api.example.com",
        timeout=60
    )

    assert conn.timeout == 60


def test_connection_ssl_verification():
    """Test Connection SSL verification."""
    conn_ssl = Connection(
        base_url="https://api.example.com",
        verify_ssl=True
    )
    assert conn_ssl.verify_ssl is True

    conn_no_ssl = Connection(
        base_url="https://api.example.com",
        verify_ssl=False
    )
    assert conn_no_ssl.verify_ssl is False


def test_connection_json_serialization():
    """Test Connection can be serialized to dict."""
    conn = Connection(
        base_url="https://api.example.com",
        auth_type="bearer",
        auth_token="token_xyz",
        headers={"User-Agent": "Test/1.0"},
    )

    conn_dict = conn.dict(exclude_none=True)
    assert conn_dict["base_url"] == "https://api.example.com"
    assert conn_dict["auth_type"] == "bearer"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
