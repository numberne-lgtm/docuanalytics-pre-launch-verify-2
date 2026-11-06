"""Preview and production secret-file isolation. Uses dummy values only."""
import pytest
from runtime_config import load_app_env


def test_production_never_reads_preview_file(tmp_path, monkeypatch):
    (tmp_path / ".env").write_text("RESEND_API_KEY=preview-secret-DUMMY\nSTRIPE_API_KEY=preview-stripe-DUMMY\n")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("RESEND_API_KEY", "runtime-only-DUMMY")
    assert load_app_env(tmp_path) == {}
    assert __import__("os").environ["RESEND_API_KEY"] == "runtime-only-DUMMY"


def test_preview_reads_preview_only_in_test_mode(tmp_path, monkeypatch):
    (tmp_path / ".env").write_text("PR7_PREVIEW_ONLY_DUMMY=isolated\n")
    monkeypatch.setenv("APP_ENV", "test")
    env = load_app_env(tmp_path)
    assert env["PR7_PREVIEW_ONLY_DUMMY"] == "isolated"


@pytest.mark.parametrize("invalid", [None, "", "prod", "unexpected"])
def test_missing_or_ambiguous_app_env_fails_closed(tmp_path, monkeypatch, invalid):
    if invalid is None:
        monkeypatch.delenv("APP_ENV", raising=False)
    else:
        monkeypatch.setenv("APP_ENV", invalid)
    with pytest.raises(RuntimeError):
        load_app_env(tmp_path)
