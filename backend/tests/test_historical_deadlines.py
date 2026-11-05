"""Regression tests for historical legal dates in Workspace (no database needed)."""
import unittest
from workspace import core


class HistoricalDeadlineTests(unittest.TestCase):
    def test_historical_decadenza_not_operational(self):
        result = {"category": "invoice", "fields": [
            {"label": "Decadenza beneficio del termine", "value": "05/06/2008"},
            {"label": "Data documento", "value": "15/10/2015"},
        ]}
        self.assertTrue(core.is_historical_event("Decadenza beneficio del termine"))
        self.assertEqual(core.deadlines(result), [])

    def test_explicit_payment_deadline_still_detected(self):
        result = {"category": "other", "fields": [
            {"label": "Scadenza pagamento", "value": "15/12/2026"},
        ]}
        deadlines = core.deadlines(result)
        self.assertEqual(len(deadlines), 1)
        self.assertEqual(deadlines[0]["due_date"], "2026-12-15")
        self.assertEqual(deadlines[0]["kind"], "payment")

    def test_f24_and_contract_deadlines_preserved(self):
        f24 = {"category": "f24", "structured": {"due_date": "16/12/2026"}}
        contract = {"category": "contract", "structured": {"expiration_date": "31/12/2026"}}
        self.assertEqual(core.deadlines(f24)[0]["kind"], "tax")
        self.assertEqual(core.deadlines(contract)[0]["kind"], "validity")

    def test_other_historical_labels_are_not_blanket_filtered(self):
        self.assertFalse(core.is_historical_event("Scadenza contratto"))
        self.assertFalse(core.is_historical_event("Termine di pagamento"))


    def test_legacy_auto_detected_historical_deadline_hidden(self):
        for status in ("detected", "to_verify"):
            with self.subTest(status=status):
                self.assertFalse(core.show_operational_deadline({
                    "source": "auto", "status": status,
                    "label": "Decadenza beneficio del termine", "due_date": "2008-06-05",
                }))

    def test_confirmed_and_manual_deadlines_preserved(self):
        for source, status in (("auto", "confirmed"), ("manual", "detected"),
                               ("manual", "confirmed"), ("auto", None)):
            with self.subTest(source=source, status=status):
                self.assertTrue(core.show_operational_deadline({
                    "source": source, "status": status,
                    "label": "Decadenza beneficio del termine", "due_date": "2008-06-05",
                }))

    def test_other_legacy_auto_deadlines_preserved(self):
        self.assertTrue(core.show_operational_deadline({
            "source": "auto", "status": "detected",
            "label": "Scadenza pagamento", "due_date": "2026-12-15",
        }))

if __name__ == "__main__":
    unittest.main()
