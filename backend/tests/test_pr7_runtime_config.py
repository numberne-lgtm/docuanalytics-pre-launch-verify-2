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


def test_public_qr_assistant_explains_preview_without_account_access():
    from assistant.workspace_guide import WORKSPACE_GUIDE, PUBLIC_RELEASE_NOTE
    from assistant.router import _system_prompt
    system = _system_prompt("- Starter: €19, 50 crediti", "commercialista")
    for feature in ("Panoramica", "Documenti", "Scadenze", "verifica professionale", "QR"):
        assert feature.casefold() in system.casefold(), feature
    assert WORKSPACE_GUIDE in system
    assert PUBLIC_RELEASE_NOTE in system
    assert "ANTEPRIMA" in system
    assert "Non hai accesso a documenti, account, dati di utenti o database" in system
    assert "€19" in system


def test_public_assistant_qr_link_does_not_depend_on_registered_account():
    from pathlib import Path
    p = Path(__file__).resolve().parents[2] / "frontend" / "public" / "assistant-qr" / "links.txt"
    links = p.read_text(encoding="utf-8")
    assert "https://docuanalytics.online/assistant" in links
    assert "utm_source=qr" in links
    assert "/area/documenti" not in links


def test_public_and_account_assistant_guides_are_separated():
    from assistant.workspace_guide import WORKSPACE_GUIDE, PUBLIC_RELEASE_NOTE
    assert "documenti" in WORKSPACE_GUIDE.lower()
    assert "non" in PUBLIC_RELEASE_NOTE.lower() and "produzione" in PUBLIC_RELEASE_NOTE.lower()
    assert "non" in WORKSPACE_GUIDE.lower() and "scadenze" in WORKSPACE_GUIDE.lower()


def test_assistant_release_note_switches_only_in_production(monkeypatch):
    from assistant.workspace_guide import current_release_note, PUBLIC_LIVE_NOTE, PUBLIC_RELEASE_NOTE
    from assistant.router import _system_prompt
    monkeypatch.setenv("APP_ENV", "test")
    assert current_release_note() == PUBLIC_RELEASE_NOTE
    assert PUBLIC_RELEASE_NOTE in _system_prompt("", None)
    monkeypatch.setenv("APP_ENV", "production")
    assert current_release_note() == PUBLIC_LIVE_NOTE
    assert PUBLIC_LIVE_NOTE in _system_prompt("", None)
    monkeypatch.delenv("APP_ENV", raising=False)
    assert current_release_note() == PUBLIC_RELEASE_NOTE
