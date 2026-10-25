"""Deterministic helpers for the workspace (Cliente 360, risk, deadlines, multi-doc audit). No AI here."""
import re
from datetime import date, datetime

DATE_RE = re.compile(r"\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b")
DEADLINE_WORDS = {
    "payment": ("scadenza pagamento", "pagamento", "scadenza fattura", "data scadenza", "termine di pagamento"),
    "renewal": ("rinnovo", "tacito rinnovo"),
    "withdrawal": ("recesso", "disdetta"),
    "notice": ("preavviso",),
    "validity": ("validità", "valido fino", "scadenza contratto", "data di scadenza", "termine"),
}
KIND_LABEL = {"payment": "Pagamento", "tax": "Scadenza fiscale", "renewal": "Rinnovo", "withdrawal": "Termine di recesso",
              "notice": "Preavviso", "validity": "Validità / scadenza", "start": "Decorrenza", "other": "Data operativa"}


def norm_id(v) -> str:
    s = re.sub(r"[^A-Za-z0-9]", "", str(v or "")).upper()
    return s[2:] if s.startswith("IT") and len(s) == 13 else s


def norm_name(v) -> str:
    s = re.sub(r"[^a-z0-9 ]", " ", str(v or "").lower())
    s = re.sub(r"\b(srl|s r l|spa|s p a|snc|sas|srls|ss|studio|ditta)\b", " ", s)
    return " ".join(s.split())


def parse_date(v):
    """Return (iso_date or None, certain: bool)."""
    if not v:
        return None, False
    m = DATE_RE.search(str(v))
    if not m:
        return None, False
    try:
        if m.group(1):
            d = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        else:
            d = date(int(m.group(4)), int(m.group(5)), int(m.group(6)))
    except ValueError:
        return None, False
    exact = str(v).strip() == m.group(0)
    return d.isoformat(), exact


def subjects(result: dict) -> list:
    """Identifiable subjects (name/piva/cf/role) found in an analysis result."""
    s, cat = result.get("structured") or {}, result.get("category")
    out = []

    def add(name, piva="", cf="", role="", extra=None):
        if name or piva or cf:
            out.append({"name": (name or "").strip(), "piva": norm_id(piva), "cf": norm_id(cf), "role": role, "extra": extra or {}})

    if cat == "invoice":
        for role in ("supplier", "customer"):
            p = s.get(role) or {}
            add(p.get("name"), p.get("piva"), p.get("codice_fiscale"), "Fornitore" if role == "supplier" else "Cliente")
    elif cat == "f24":
        t = s.get("taxpayer") or {}
        add(t.get("name"), "", t.get("codice_fiscale"), "Contribuente")
    elif cat == "visura":
        c = s.get("company") or {}
        extra = {k: v for k, v in {"rea": c.get("rea"), "pec": c.get("pec"), "registered_office": s.get("registered_office"),
                                   "legal_form": s.get("legal_form"), "share_capital": s.get("share_capital"),
                                   "legal_representatives": s.get("legal_representatives") or []}.items() if v}
        add(c.get("denominazione"), c.get("piva"), c.get("codice_fiscale"), "Società", extra)
    elif cat == "contract":
        for p in s.get("parties") or []:
            pid = norm_id(p.get("piva_cf"))
            add(p.get("name"), pid if len(pid) == 11 else "", pid if len(pid) == 16 else "", p.get("role") or "Parte")
    return out


def match_client(subj: dict, clients: list):
    """Exact identifier match only. Returns client or None."""
    for c in clients:
        if subj["piva"] and subj["piva"] == c.get("piva"):
            return c
        if subj["cf"] and subj["cf"] == c.get("cf"):
            return c
    return None


def deadlines(result: dict) -> list:
    """Dates explicitly present in the analysis. Never invents."""
    s, cat, out = result.get("structured") or {}, result.get("category"), []

    def add(kind, raw, label):
        if not raw:
            return
        iso, certain = parse_date(raw)
        out.append({"kind": kind, "label": label, "raw_date": str(raw)[:80], "due_date": iso,
                    "status": "detected" if iso and certain else "to_verify"})

    if cat == "f24":
        add("tax", s.get("due_date"), "Scadenza versamento F24")
    if cat == "contract":
        add("validity", s.get("expiration_date"), "Scadenza contratto")
        for r in s.get("reminders") or []:
            lbl = (r.get("label") or "Scadenza contrattuale")[:160]
            low = lbl.lower()
            kind = next((k for k, words in DEADLINE_WORDS.items() if any(w in low for w in words)), "other")
            add(kind, r.get("date"), lbl)
    for f in result.get("fields") or []:
        low = str(f.get("label", "")).lower()
        kind = next((k for k, words in DEADLINE_WORDS.items() if any(w in low for w in words)), None)
        if kind and DATE_RE.search(str(f.get("value", ""))):
            add(kind, f.get("value"), str(f.get("label"))[:160])
    seen, uniq = set(), []
    for d in out:
        key = (d["kind"], d["due_date"] or d["raw_date"])
        if key not in seen:
            seen.add(key)
            uniq.append(d)
    return uniq


def doc_risk(result: dict) -> str:
    levels = {a.get("level") for a in result.get("audit") or []}
    return "high" if "error" in levels else "medium" if "warning" in levels else "low"


def deadline_priority(days_left, status) -> str:
    if days_left is None or status == "to_verify":
        return "medium"
    return "high" if days_left <= 7 else "medium" if days_left <= 30 else "low"


def days_left(iso):
    if not iso:
        return None
    try:
        return (datetime.strptime(iso, "%Y-%m-%d").date() - date.today()).days
    except ValueError:
        return None


def flatten(obj, prefix=""):
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.update(flatten(v, f"{prefix}.{k}" if prefix else k))
    elif isinstance(obj, list):
        if obj and all(not isinstance(x, (dict, list)) for x in obj):
            out[prefix] = "; ".join(str(x) for x in obj if str(x).strip())
        else:
            for i, v in enumerate(obj[:20]):
                out.update(flatten(v, f"{prefix}[{i}]"))
    elif obj not in (None, ""):
        out[prefix] = str(obj).strip()
    return out


def _cmp_val(path, v):
    if re.search(r"piva|codice_fiscale|piva_cf|iban|rea", path):
        return norm_id(v)
    if re.search(r"date", path):
        return parse_date(v)[0] or v.strip().lower()
    num = re.sub(r"[^\d,.\-]", "", v)
    if num and re.fullmatch(r"-?[\d.]*,?\d+", num):
        try:
            return f"{float(num.replace('.', '').replace(',', '.')):.2f}"
        except ValueError:
            pass
    return " ".join(v.lower().split())


def compare(docs: list) -> dict:
    """docs: [{ref, analysis_id, filename, category, result}] -> consistent / differences / anomalies / to_verify."""
    res = {"consistent": [], "differences": [], "anomalies": [], "to_verify": []}
    src = lambda d: {"ref": d["ref"], "analysis_id": d["analysis_id"], "filename": d["filename"]}
    by_cat = {}
    for d in docs:
        by_cat.setdefault(d["category"], []).append(d)
    for cat, group in by_cat.items():
        if len(group) < 2:
            continue
        flat = [flatten((d["result"].get("structured") or {})) for d in group]
        for path in sorted(set().union(*flat)):
            if path.endswith("currency"):
                continue
            vals = [(d, f.get(path)) for d, f in zip(group, flat)]
            present = [(d, v) for d, v in vals if v]
            missing = [d for d, v in vals if not v]
            norm = {_cmp_val(path, v) for _, v in present}
            item = {"field": path, "category": cat, "values": [{**src(d), "value": v} for d, v in present]}
            if len(present) >= 2 and len(norm) == 1:
                res["consistent"].append(item)
            elif len(present) >= 2:
                res["differences"].append(item)
            if present and missing:
                res["to_verify"].append({**item, "note": "Dato presente in alcuni documenti e assente in altri",
                                         "missing_in": [src(d) for d in missing]})
    ids = []
    for d in docs:
        for s in subjects(d["result"]):
            ids.append((d, s))
    for i, (da, a) in enumerate(ids):
        for db_, b in ids[i + 1:]:
            if da is db_:
                continue
            na, nb = norm_name(a["name"]), norm_name(b["name"])
            same_name = na and na == nb
            for key, label in (("piva", "Partita IVA"), ("cf", "Codice Fiscale")):
                if same_name and a[key] and b[key] and a[key] != b[key]:
                    res["anomalies"].append({"type": f"{label} diversa per lo stesso nome", "subject": a["name"],
                                             "values": [{**src(da), "value": a[key]}, {**src(db_), "value": b[key]}]})
                if a[key] and a[key] == b[key] and na and nb and na != nb:
                    res["to_verify"].append({"field": f"Nome associato alla stessa {label}", "category": "subjects",
                                             "values": [{**src(da), "value": a["name"]}, {**src(db_), "value": b["name"]}],
                                             "note": "Stesso identificativo con denominazioni diverse"})
    for d in docs:
        s = d["result"].get("structured") or {}
        if d["category"] == "contract":
            a, b = parse_date(s.get("effective_date"))[0], parse_date(s.get("expiration_date"))[0]
            if a and b and b < a:
                res["anomalies"].append({"type": "Data di scadenza precedente alla decorrenza", "subject": d["filename"],
                                         "values": [{**src(d), "value": f"decorrenza {s.get('effective_date')} / scadenza {s.get('expiration_date')}"}]})
    return res
