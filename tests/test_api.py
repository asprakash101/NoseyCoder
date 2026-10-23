"""
API integration tests for NoseyCoder backend.
Uses httpx.AsyncClient with a mocked MongoDB to test FastAPI endpoints
without needing a running database.
"""
import sys
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import httpx

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Patch MongoDB before importing server
mock_collection = MagicMock()
mock_collection.insert_one = AsyncMock()
mock_collection.find = MagicMock()

# Create a mock cursor that supports chaining: find().sort().to_list()
mock_cursor = MagicMock()
mock_cursor.sort = MagicMock(return_value=mock_cursor)
mock_cursor.to_list = AsyncMock(return_value=[])
mock_collection.find.return_value = mock_cursor

mock_db = MagicMock()
mock_db.__getitem__ = MagicMock(return_value=mock_collection)
mock_db.analysis_history = mock_collection

# Patch the module-level db before import
with patch.dict(os.environ, {
    'MONGO_URL': 'mongodb://localhost:27017',
    'DB_NAME': 'test_noseycoder',
}):
    import server
    server.db = mock_db

from server import app

from tests.conftest import SAMPLE_JS_SIMPLE, SAMPLE_JS_COMPLEX, SAMPLE_PY_COMPLEX


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    from httpx import ASGITransport
    transport = ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


# ════════════════════════════════════════════════════
# GET /api/health
# ════════════════════════════════════════════════════

class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health_returns_200(self, client):
        async with client:
            resp = await client.get("/api/health")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_health_returns_ok_status(self, client):
        async with client:
            resp = await client.get("/api/health")
        data = resp.json()
        assert data["status"] == "ok"
        assert "service" in data


# ════════════════════════════════════════════════════
# GET /api/
# ════════════════════════════════════════════════════

class TestRootEndpoint:
    @pytest.mark.asyncio
    async def test_root_returns_message(self, client):
        async with client:
            resp = await client.get("/api/")
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data


# ════════════════════════════════════════════════════
# POST /api/analyze — JavaScript
# ════════════════════════════════════════════════════

class TestAnalyzeJavaScript:
    @pytest.mark.asyncio
    async def test_js_analysis_200(self, client):
        async with client:
            resp = await client.post("/api/analyze", json={
                "code": SAMPLE_JS_SIMPLE,
                "filename": "test.js"
            })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_js_analysis_structure(self, client):
        async with client:
            resp = await client.post("/api/analyze", json={
                "code": SAMPLE_JS_COMPLEX,
                "filename": "test.js"
            })
        data = resp.json()
        assert data["language"] == "javascript"
        assert "summary" in data
        assert "functions" in data
        assert "linterIssues" in data
        assert "refactorSuggestions" in data
        assert "heatmap" in data

    @pytest.mark.asyncio
    async def test_js_function_count(self, client):
        async with client:
            resp = await client.post("/api/analyze", json={
                "code": SAMPLE_JS_COMPLEX,
                "filename": "test.js"
            })
        data = resp.json()
        assert data["summary"]["functionCount"] >= 2

    @pytest.mark.asyncio
    async def test_js_complexity_positive(self, client):
        async with client:
            resp = await client.post("/api/analyze", json={
                "code": SAMPLE_JS_COMPLEX,
                "filename": "test.js"
            })
        data = resp.json()
        assert data["summary"]["cyclomaticComplexity"] > 1


# ════════════════════════════════════════════════════
# POST /api/analyze — Python
# ════════════════════════════════════════════════════

class TestAnalyzePython:
    @pytest.mark.asyncio
    async def test_py_analysis_200(self, client):
        async with client:
            resp = await client.post("/api/analyze", json={
                "code": SAMPLE_PY_COMPLEX,
                "filename": "test.py"
            })
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_py_language_detection(self, client):
        async with client:
            resp = await client.post("/api/analyze", json={
                "code": SAMPLE_PY_COMPLEX,
                "filename": "test.py"
            })
        data = resp.json()
        assert data["language"] == "python"

    @pytest.mark.asyncio
    async def test_py_functions_extracted(self, client):
        async with client:
            resp = await client.post("/api/analyze", json={
                "code": SAMPLE_PY_COMPLEX,
                "filename": "test.py"
            })
        data = resp.json()
        assert len(data["functions"]) >= 2


# ════════════════════════════════════════════════════
# POST /api/analyze — Edge cases
# ════════════════════════════════════════════════════

class TestAnalyzeEdgeCases:
    @pytest.mark.asyncio
    async def test_unsupported_language(self, client):
        async with client:
            resp = await client.post("/api/analyze", json={
                "code": "SELECT * FROM users;",
                "filename": "query.sql"
            })
        data = resp.json()
        assert data["language"] == "unknown"
        assert "error" in data

    @pytest.mark.asyncio
    async def test_missing_code_field(self, client):
        async with client:
            resp = await client.post("/api/analyze", json={
                "filename": "test.js"
            })
        assert resp.status_code == 422  # Pydantic validation error

    @pytest.mark.asyncio
    async def test_empty_body(self, client):
        async with client:
            resp = await client.post("/api/analyze", json={})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_default_filename(self, client):
        async with client:
            resp = await client.post("/api/analyze", json={
                "code": "function f() { return 1; }"
            })
        data = resp.json()
        # Default filename is "untitled.js"
        assert data["filename"] == "untitled.js"
        assert data["language"] == "javascript"

    @pytest.mark.asyncio
    async def test_oversized_payload_returns_413(self, client):
        huge_code = "x = 1;\n" * 200_000  # > 1MB
        async with client:
            resp = await client.post("/api/analyze", json={
                "code": huge_code,
                "filename": "big.js"
            })
        assert resp.status_code == 413
        assert "exceeds maximum limit" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_db_failure_does_not_crash_analyze(self, client):
        with patch.object(server.db.analysis_history, "insert_one", new_callable=AsyncMock) as mock_insert:
            mock_insert.side_effect = Exception("MongoDB connection refused")
            async with client:
                resp = await client.post("/api/analyze", json={
                    "code": "function test() { return true; }",
                    "filename": "test.js"
                })
            assert resp.status_code == 200
            assert resp.json()["language"] == "javascript"


# ════════════════════════════════════════════════════
# GET /api/history
# ════════════════════════════════════════════════════

class TestHistoryEndpoint:
    @pytest.mark.asyncio
    async def test_history_returns_200(self, client):
        async with client:
            resp = await client.get("/api/history")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_history_returns_list(self, client):
        async with client:
            resp = await client.get("/api/history")
        data = resp.json()
        assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_history_db_failure_returns_empty_list(self, client):
        with patch.object(server.db.analysis_history, "find", side_effect=Exception("MongoDB offline")):
            async with client:
                resp = await client.get("/api/history")
            assert resp.status_code == 200
            assert resp.json() == []


# ════════════════════════════════════════════════════
# GitHub OAuth Endpoints
# ════════════════════════════════════════════════════

class TestGitHubOAuthEndpoints:
    @pytest.mark.asyncio
    async def test_oauth_config(self, client):
        async with client:
            resp = await client.get("/api/auth/github/config")
        assert resp.status_code == 200
        data = resp.json()
        assert "client_id" in data

    @pytest.mark.asyncio
    async def test_oauth_callback_missing_credentials(self, client):
        with patch.dict(os.environ, {"GITHUB_CLIENT_ID": "", "GITHUB_CLIENT_SECRET": ""}):
            async with client:
                resp = await client.post("/api/auth/github/callback", json={"code": "dummy_code"})
            assert resp.status_code == 500
            assert "not configured" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_oauth_callback_success(self, client):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": "ghu_mock_access_token_12345",
            "token_type": "bearer",
            "scope": "public_repo,workflow,read:user"
        }

        mock_http_client = AsyncMock()
        mock_http_client.post.return_value = mock_response
        mock_http_client.__aenter__.return_value = mock_http_client
        mock_http_client.__aexit__.return_value = None

        with patch.dict(os.environ, {
            "GITHUB_CLIENT_ID": "mock_client_id",
            "GITHUB_CLIENT_SECRET": "mock_client_secret"
        }):
            with patch("server.httpx.AsyncClient", return_value=mock_http_client):
                async with client:
                    resp = await client.post("/api/auth/github/callback", json={
                        "code": "valid_test_code",
                        "redirect_uri": "https://test.chromiumapp.org/"
                    })

                assert resp.status_code == 200
                data = resp.json()
                assert data["access_token"] == "ghu_mock_access_token_12345"
                assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_oauth_callback_github_error(self, client):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "error": "bad_verification_code",
            "error_description": "The code passed is incorrect or expired."
        }

        mock_http_client = AsyncMock()
        mock_http_client.post.return_value = mock_response
        mock_http_client.__aenter__.return_value = mock_http_client
        mock_http_client.__aexit__.return_value = None

        with patch.dict(os.environ, {
            "GITHUB_CLIENT_ID": "mock_client_id",
            "GITHUB_CLIENT_SECRET": "mock_client_secret"
        }):
            with patch("server.httpx.AsyncClient", return_value=mock_http_client):
                async with client:
                    resp = await client.post("/api/auth/github/callback", json={
                        "code": "expired_code"
                    })

                assert resp.status_code == 400
                data = resp.json()
                assert "incorrect or expired" in data["detail"]

    @pytest.mark.asyncio
    async def test_oauth_callback_get_method(self, client):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "access_token": "ghu_get_callback_token"
        }

        mock_http_client = AsyncMock()
        mock_http_client.post.return_value = mock_response
        mock_http_client.__aenter__.return_value = mock_http_client
        mock_http_client.__aexit__.return_value = None

        with patch.dict(os.environ, {
            "GITHUB_CLIENT_ID": "mock_client_id",
            "GITHUB_CLIENT_SECRET": "mock_client_secret"
        }):
            with patch("server.httpx.AsyncClient", return_value=mock_http_client):
                async with client:
                    resp = await client.get("/api/auth/github/callback?code=get_code")

                assert resp.status_code == 200
                assert resp.json()["access_token"] == "ghu_get_callback_token"
