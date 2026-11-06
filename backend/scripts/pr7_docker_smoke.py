"""Smoke test the Docker Compose staging via localhost only, never live APIs.

Requires PR7 Docker stack to already be running on 127.0.0.1:8765.
Uses only public synthetic fixture credentials and requests.
"""
import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8765"


def request(method, path, payload=None, token=None):
    data = json.dumps(payload).encode() if payload is not None else None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            return response.status, response.read(), dict(response.headers)
    except urllib.error.HTTPError as error:
        return error.code, error.read(), dict(error.headers)


def assert_status(expected, method, path, payload=None, token=None):
    status, data, headers = request(method, path, payload, token)
    assert status == expected, (method, path, status, data[:250])
    return data, headers


def main():
    response, headers = assert_status(200, "GET", "/api/pr7-staging/status")
    csp = next((v for k, v in headers.items() if k.lower() == "content-security-policy"), "")
    assert "connect-src 'self'" in csp, headers
    status = json.loads(response)
    assert status["environment"] == "synthetic-local"
    assert status["billable_integrations"] is False
    assert_status(200, "GET", "/area")
    assert_status(401, "GET", "/api/workspace/overview")

    tokens = {}
    for letter in ("a", "b"):
        answer, _ = assert_status(200, "POST", "/api/auth/login", {
            "email": f"studio-{letter}@demo.invalid",
            "password": "synthetic-local-only",
        })
        tokens[letter] = json.loads(answer)["token"]
    assert_status(404, "GET", "/api/workspace/priorities/document/pr7-analysis-a", token=tokens["b"])
    detail, _ = assert_status(200, "GET", "/api/workspace/priorities/document/pr7-analysis-a", token=tokens["a"])
    assert json.loads(detail)["filename"] == "contratto-fittizio-a.pdf"
    qr, _ = assert_status(200, "GET", "/api/workspace/priorities/document/pr7-analysis-a/qr", token=tokens["a"])
    assert qr.startswith(bytes((137, 80, 78, 71)))
    pdf, _ = assert_status(200, "GET", "/api/workspace/priorities/document/pr7-analysis-a/pdf", token=tokens["a"])
    assert pdf.startswith(b"%PDF-")
    assert_status(200, "PUT", "/api/workspace/priorities/read-state", {
        "type": "document", "item_id": "pr7-analysis-a", "is_read": True
    }, token=tokens["a"])
    overview, _ = assert_status(200, "GET", "/api/workspace/overview", token=tokens["a"])
    matches = [p for p in json.loads(overview)["priorities"]
               if p.get("analysis_id") == "pr7-analysis-a"]
    assert matches and matches[0]["is_read"] is True
    for method, path in (
        ("POST", "/api/workspace/copilot/ask"),
        ("POST", "/api/analyze"),
        ("POST", "/api/payments/checkout"),
    ):
        assert_status(503, method, path, {"question": "FAKE DATA ONLY"}, token=tokens["a"])
    print("PR7 DOCKER COMPOSE PASS: local-only, fake auth, QR, PDF, read-state, cross-user, paid APIs blocked")


if __name__ == "__main__":
    main()
