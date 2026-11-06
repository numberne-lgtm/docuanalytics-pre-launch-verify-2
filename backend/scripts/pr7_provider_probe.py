"""PR #7 preview-only, opt-in single request to verify the actual Emergent LLM route.

This script is deliberately never run in CI or by importing it.
Example in a disposable preview process (never on production):
  APP_ENV=test PR7_PROVIDER_TEST_APPROVED=YES_ONE_SYNTHETIC_CALL \
    python backend/scripts/pr7_provider_probe.py

Requires an already configured EMERGENT_LLM_KEY in the preview environment.
DO NOT paste, print, commit or copy any API key.
"""
import asyncio
import os
import sys
import time
import uuid


async def main():
    mode = os.environ.get("APP_ENV", "").lower()
    if mode not in {"test", "preview", "development"}:
        print("BLOCKED: APP_ENV must be test, preview or development (never production).")
        return 2
    if os.environ.get("PR7_PROVIDER_TEST_APPROVED") != "YES_ONE_SYNTHETIC_CALL":
        print("BLOCKED: an explicit single billable test approval is required.")
        return 2
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        print("BLOCKED: no Emergent Universal LLM Key is configured for preview.")
        return 2

    # No real customer names, account IDs, document content, or secrets in the prompt.
    synthetic_question = (
        "Esegui un controllo tecnico con dati fittizi. "
        "Un promemoria di prova ha la data 2027-05-15 e lo stato 'da verificare'. "
        "Scrivi una breve frase italiana che contenga il codice VERIFICA_PR7_OK "
        "e spieghi che una data da verificare non e' una scadenza certa."
    )
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    chat = LlmChat(
        api_key=key,
        session_id="pr7-synthetic-" + str(uuid.uuid4()),
        system_message="Sei un assistente di collaudo. Usa solo il testo sintetico fornito.",
    ).with_model("openai", "gpt-5.4-mini")

    start = time.monotonic()
    try:
        result = await asyncio.wait_for(
            chat.send_message(UserMessage(text=synthetic_question)), timeout=30
        )
    except Exception as exc:
        # No exception messages: provider errors may contain URLs, headers or request bodies.
        print("PROBE FAILED:", type(exc).__name__)
        return 1
    elapsed = round(time.monotonic() - start, 2)
    reply = str(result)
    print("MODEL_ROUTE: openai/gpt-5.4-mini via Emergent LlmChat")
    print("ANSWER_RECEIVED:", bool(reply.strip()))
    print("EXPECTED_MARKER_PRESENT:", "VERIFICA_PR7_OK" in reply)
    print("RESPONSE_CHARACTER_COUNT:", len(reply))
    print("LATENCY_SECONDS:", elapsed)
    print("CHECK EMERGENT CREDIT USAGE DASHBOARD FOR THE ACTUAL CHARGE.")
    return 0 if "VERIFICA_PR7_OK" in reply else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
