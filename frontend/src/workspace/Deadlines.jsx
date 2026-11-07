import { useEffect, useState } from "react";
import { AlertTriangle, CalendarCheck2, CalendarClock, CalendarPlus2, CheckCircle2, ChevronDown, Clock3, FileSearch, Filter, Mail, PencilLine, Search, Settings2, ShieldCheck, Trash2, UserRoundX } from "lucide-react";
import { navigateRows, markActiveRow, selectRowWithMouse } from "./keyboard";
import { ws, errMsg, fmtDate, dueText } from "./api";
import { Level } from "./RiskDashboard";
import DateField from "./DateField";
import CalendarExport from "./CalendarExport";
import DigestSettings from "./DigestSettings";

const CHOICES = [[30, "30 gg"], [15, "15 gg"], [7, "7 gg"], [3, "3 gg"], [1, "1 g"], [0, "Il giorno stesso"]];
const DEFAULT_DAYS = [30, 7, 1];
const daysText = (ds) => !ds || !ds.length ? "nessun avviso email"
  : "avvisi: " + [...ds].sort((a, b) => b - a).map((x) => (x === 0 ? "il giorno stesso" : `${x} gg prima`)).join(", ");

function NotifyPicker({ value, onChange, testid }) {
  const toggle = (x) => onChange(value.includes(x) ? value.filter((v) => v !== x) : [...value, x]);
  return (
    <div className="ws-notify" data-testid={testid}>
      <span className="ws-muted">Email di avviso:</span>
      {CHOICES.map(([x, l]) => (
        <button type="button" key={x} className={`ws-chip ${value.includes(x) ? "on" : ""}`} aria-pressed={value.includes(x)}
          onClick={() => toggle(x)} data-testid={`${testid}-${x}`}>{l}</button>
      ))}
    </div>
  );
}


function Row({ d, onChanged, onOpenDoc }) {
  const [edit, setEdit] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [date, setDate] = useState(d.due_date || "");
  const [label, setLabel] = useState(d.label);
  const [note, setNote] = useState(d.note || "");
  const [days, setDays] = useState((d.status === "confirmed" ? d.notify_days : d.notify_pref) ?? DEFAULT_DAYS);
  const [toClient, setToClient] = useState(!!d.notify_client);
  const [cmsg, setCmsg] = useState(d.client_message || "");
  const [notifyOnConfirm, setNotifyOnConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const confirmed = d.status === "confirmed";
  const uncertain = d.status === "to_verify" || !d.due_date;
  const overdue = confirmed && d.days_left != null && d.days_left < 0;
  const timing = uncertain ? "Data da verificare" : dueText(d.days_left);
  const tone = uncertain ? "medium" : overdue ? "high" : d.priority;
  const run = async (promise) => {
    setErr("");
    setBusy(true);
    try { await promise; setEdit(false); setShowAdvanced(false); onChanged(); }
    catch (e) { setErr(errMsg(e)); }
    finally { setBusy(false); }
  };
  const confirm = () => {
    if (!d.due_date) { setEdit(true); return; }
    if (d.days_left != null && d.days_left < 0 && !window.confirm("La data è trascorsa. Confermarla comunque? Non partiranno avvisi per giorni già passati.")) return;
    return run(ws.post(`/deadlines/${d.reminder_id}/confirm`, {
      notify: notifyOnConfirm && !(d.days_left != null && d.days_left < 0),
      notify_days: notifyOnConfirm ? days : []
    }));
  };
  const save = () => run(ws.patch(`/deadlines/${d.reminder_id}`, {
    label, due_date: date || undefined, note, notify_days: days,
    ...(d.client_id ? { notify_client: toClient, client_message: cmsg } : {})
  }));
  const category = d.status === "to_verify" ? "Data da controllare"
    : d.status === "detected" ? "Data rilevata dall'AI" : "Data confermata";
  return (
    <article className={"ws-dl ws-deadline-card" + (["high","medium","low"].includes(tone) ? " ws-tone-" + tone : "")}
      data-ws-nav-row data-ws-nav-key={d.reminder_id} tabIndex={0} role="group"
      aria-label={"Scadenza: " + d.label} data-testid={"deadline-" + d.reminder_id}>
      <header className="ws-deadline-head">
        <div className="ws-deadline-ident">
          <span className="ws-deadline-kind">{d.kind_label || "Scadenza"}</span>
          <strong>{d.label}</strong>
          <span className="ws-deadline-metadata">
            {d.client_name ? "Cliente: " + d.client_name : "Cliente non associato"}
            {d.source === "manual" ? " · Inserita manualmente" : " · Rilevata dal documento"}
          </span>
        </div>
        <div className="ws-deadline-date">
          <span className="ws-deadline-date-main">{d.due_date ? fmtDate(d.due_date) : (d.raw_date || "Data incerta")}</span>
          <span className={"ws-deadline-timing" + (overdue ? " is-overdue" : uncertain ? " is-uncertain" : "")}>{timing}</span>
        </div>
      </header>
      <div className="ws-deadline-badges">
        <span className={"ws-tag st-" + d.status} data-testid={"deadline-status-" + d.reminder_id}>{category}</span>
        <span className="ws-deadline-priority-label">Priorità: <Level level={d.priority} /></span>
      </div>
      <div className="ws-deadline-state" data-testid={"deadline-notify-" + d.reminder_id}>
        <Mail size={15} aria-hidden="true" />
        {confirmed && d.notify_days?.length ? daysText(d.notify_days) : "Nessun avviso email attivo"}
        {confirmed && d.notify_client && d.notify_days?.length && (
          <span> · {d.client_has_email ? "anche al cliente" : "cliente senza email: avviso non inviabile"}</span>
        )}
      </div>
      {d.note && <p className="ws-deadline-note" data-testid={"deadline-note-" + d.reminder_id}><strong>Nota:</strong> {d.note}</p>}
      <div className="ws-deadline-actions">
        {!confirmed && (
          <button className="as-btn as-btn-primary" type="button" onClick={confirm} disabled={busy}
            data-testid={"deadline-confirm-" + d.reminder_id}>
            <CheckCircle2 size={16} aria-hidden="true" /> {busy ? "Salvataggio…" : "Conferma data"}
          </button>
        )}
        <button className="as-btn" type="button" data-ws-nav-target
          aria-expanded={edit} onClick={() => { setEdit(v => !v); setShowAdvanced(false); }}
          data-testid={"deadline-edit-" + d.reminder_id}>
          <PencilLine size={16} aria-hidden="true" /> {edit ? "Chiudi modifica" : "Modifica data e avvisi"}
        </button>
        {d.analysis_id && onOpenDoc && (
          <button className="as-btn" type="button" onClick={e => onOpenDoc(d.analysis_id, e.currentTarget)}
            data-testid={"deadline-document-" + d.reminder_id}>
            <FileSearch size={16} aria-hidden="true" /> Apri documento
          </button>
        )}
        <button className="as-btn ws-deadline-more" type="button" aria-expanded={showAdvanced}
          onClick={() => { setShowAdvanced(v => !v); setEdit(false); }}
          data-testid={"deadline-more-" + d.reminder_id}>
          <Settings2 size={16} aria-hidden="true" /> Altre opzioni <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>
      {!confirmed && !edit && <div className="ws-deadline-confirm-options">
        <label>
          <input type="checkbox" checked={notifyOnConfirm} onChange={e => setNotifyOnConfirm(e.target.checked)}
            data-testid={"deadline-confirm-notify-" + d.reminder_id} />
          Attiva anche gli avvisi email dopo la conferma
        </label>
        {notifyOnConfirm && <NotifyPicker value={days} onChange={setDays}
          testid={"deadline-confirm-notify-days-" + d.reminder_id} />}
        <p className="ws-muted">Confermare la data non significa completare l'adempimento. Senza questa scelta non vengono attivati nuovi avvisi.</p>
      </div>}
      {edit && (
        <section className="ws-dl-edit ws-deadline-editor" aria-label="Modifica scadenza">
          <h4>Modifica i dettagli</h4>
          <label>Descrizione
            <input className="as-input" aria-label="Descrizione della scadenza" value={label}
              maxLength={200} onChange={e => setLabel(e.target.value)} data-testid="deadline-edit-label" />
          </label>
          <div className="ws-deadline-field">
            <span>Data</span>
            <DateField value={date} onChange={setDate} testid="deadline-edit-date" />
          </div>
          <label>Nota operativa (facoltativa)
            <textarea className="as-input" aria-label="Nota operativa della scadenza" rows={2} maxLength={500}
              value={note} onChange={e => setNote(e.target.value)} data-testid="deadline-edit-note" />
          </label>
          <NotifyPicker value={days} onChange={setDays} testid="deadline-edit-notify" />
          {d.client_id && (
            <label className="ws-switch" data-testid="deadline-edit-client-label">
              <input type="checkbox" checked={toClient} onChange={e => setToClient(e.target.checked)}
                data-testid="deadline-edit-notify-client" />
              <span>Invia gli avvisi configurati anche al cliente via email</span>
            </label>
          )}
          {d.client_id && toClient && <>
            <textarea className="as-input ws-cmsg" aria-label="Messaggio personalizzato per il cliente"
              rows={3} maxLength={500} value={cmsg} onChange={e => setCmsg(e.target.value)}
              placeholder="Messaggio personale per il cliente (facoltativo)"
              data-testid="deadline-edit-client-message" />
            <span className="ws-muted ws-count" data-testid="deadline-edit-client-message-count">{cmsg.length}/500</span>
          </>}
          <p className="ws-muted">Le date rilevate dall'AI richiedono una conferma esplicita. Modificare non equivale a confermare.</p>
          <div className="ws-deadline-form-actions">
            <button type="button" className="as-btn as-btn-primary" disabled={busy || !label.trim()}
              onClick={save} data-testid="deadline-edit-save">Salva modifiche</button>
            <button type="button" className="as-btn" onClick={() => setEdit(false)}>Annulla</button>
          </div>
        </section>
      )}
      {showAdvanced && <section className="ws-deadline-advanced" aria-label="Azioni avanzate sulla scadenza">
        <p className="ws-muted">Queste azioni cambiano la presenza della data nei calendari e promemoria.</p>
        <button type="button" className="as-btn" disabled={busy}
          onClick={() => window.confirm("Escludere questa data dalle scadenze operative, dai calendari e dai promemoria? La voce resterà nella revisione.") &&
            run(ws.put(`/deadlines/${d.reminder_id}/operational`, { excluded: true, reason: "Esclusa dopo verifica manuale" }))}
          data-testid={"deadline-exclude-" + d.reminder_id}>
          <UserRoundX size={16} aria-hidden="true" /> Escludi dalle scadenze operative
        </button>
        <button type="button" className="as-btn ws-deadline-danger" disabled={busy}
          onClick={() => window.confirm("Eliminare questa scadenza? Non comparirà più nelle scadenze attive.") &&
            run(ws.del(`/deadlines/${d.reminder_id}`))}
          data-testid={"deadline-delete-" + d.reminder_id}>
          <Trash2 size={16} aria-hidden="true" /> Elimina scadenza
        </button>
      </section>}
      {err && <div className="ws-error" role="alert">{err}</div>}
    </article>
  );
}

export const DeadlineList = ({ items, onChanged, onOpenDoc }) => (
  items.length ? <div data-ws-nav-list onKeyDown={navigateRows} onFocus={markActiveRow} onMouseDown={markActiveRow} onClick={selectRowWithMouse}>{items.map((d) => <Row key={d.reminder_id} d={d} onChanged={onChanged} onOpenDoc={onOpenDoc} />)}</div> : <p className="ws-muted">Nessuna scadenza.</p>
);

function HistoricalReview({ reloadKey, onChanged, query }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    let live = true;
    ws.get("/deadlines/review")
      .then((result) => { if (live) { setData(result); setErr(""); } })
      .catch((e) => { if (live) setErr(errMsg(e)); });
    return () => { live = false; };
  }, [reloadKey]);
  const restore = async (d) => {
    if (!window.confirm("Ripristinare la data come scadenza operativa? Potrà tornare nei calendari e nei promemoria.")) return;
    setBusy(d.reminder_id);
    setErr("");
    try {
      await ws.put(`/deadlines/${d.reminder_id}/operational`, { excluded: false });
      onChanged();
    } catch (e) { setErr(errMsg(e)); }
    finally { setBusy(null); }
  };
  if (err) return <p role="alert" className="ws-error">{err}</p>;
  if (!data) return <p className="ws-muted">Caricamento revisione…</p>;
  const q = (query || "").trim().toLocaleLowerCase("it");
  const items = data.items.filter(x => !q || [x.label,x.raw_date,x.due_date,x.doc_type]
    .some(v => String(v || "").toLocaleLowerCase("it").includes(q)));
  return (
    <div data-testid="historical-review" data-ws-nav-list onKeyDown={navigateRows} onFocus={markActiveRow} onMouseDown={markActiveRow} onClick={selectRowWithMouse}>
      <p className="ws-muted">Eventi storici e scadenze escluse. Non sono cancellati: puoi consultarli, correggerli o ripristinare quelli effettivamente operativi. Una data storica rilevata automaticamente richiede conferma esplicita per essere riattivata.</p>
      {data.limited && <p className="ws-note">Elenco parziale: sono mostrati al massimo 250 elementi.</p>}
      {items.length === 0 && <p className="ws-muted">Nessuna voce da revisionare con i filtri selezionati.</p>}
      {items.map((d) => (
        <div key={d.reminder_id} className="ws-dl" data-ws-nav-row data-ws-nav-key={d.reminder_id} tabIndex={0} role="group" aria-label={`Revisione: ${d.label}`} data-testid={`review-${d.reminder_id}`}>
          <div className="ws-dl-main">
            <span><b>{d.label}</b> · {d.due_date ? fmtDate(d.due_date) : (d.raw_date || "Data incerta")}</span>
            <span className="ws-tag">{d.operational_excluded ? "Esclusa dalle scadenze" : d.legacy_historical ? "Evento storico non confermato" : d.legal_date_review ? "Data legale da verificare" : "Da valutare"}</span>
          </div>
          <div className="ws-dl-actions">
            {d.operational_excluded && <button type="button" className="as-btn" disabled={busy === d.reminder_id} onClick={() => restore(d)}>Ripristina</button>}
            {d.legal_date_review && !d.operational_excluded && <button type="button" className="as-btn" disabled={busy === d.reminder_id} onClick={() => {
              if (!window.confirm("Escludere questa data legale dalle scadenze operative, calendari e notifiche?")) return;
              setBusy(d.reminder_id); setErr("");
              ws.put(`/deadlines/${d.reminder_id}/operational`, {excluded: true, reason: "Data legale non operativa dopo revisione"})
                .then(onChanged).catch((e) => setErr(errMsg(e))).finally(() => setBusy(null));
            }}>Escludi dopo verifica</button>}
            {d.legacy_historical && !d.operational_excluded && <button type="button" className="as-btn" onClick={() => window.confirm("Vuoi confermare esplicitamente questo evento storico come scadenza operativa?") && ws.post(`/deadlines/${d.reminder_id}/confirm`, { notify: false }).then(onChanged).catch((e) => setErr(errMsg(e)))}>Conferma senza notifiche</button>}
          </div>
        </div>
      ))}
    </div>
  );
}


const BUCKETS = [
  ["inbox", "Da gestire"],
  ["overdue", "Scadute"],
  ["today", "Oggi"],
  ["next7", "Prossimi 7 giorni"],
  ["next30", "Da 8 a 30 giorni"],
  ["to_verify", "Date da verificare"],
  ["later", "Oltre 30 giorni"],
  ["review", "Storiche / escluse"]
];
const BUCKET_ORDER = ["overdue", "today", "to_verify", "next7", "next30"];
const URGENCY = {
  overdue: { label: "Scadute", icon: AlertTriangle, help: "Controlla che l'adempimento sia stato gestito e aggiorna la scadenza." },
  today: { label: "Da gestire oggi", icon: CalendarClock, help: "Verifica le attività con scadenza odierna." },
  to_verify: { label: "Date da confermare", icon: ShieldCheck, help: "Le date individuate dall'AI richiedono una conferma prima di essere usate operativamente." },
  next7: { label: "Nei prossimi 7 giorni", icon: Clock3, help: "Prepara in anticipo le attività più vicine." },
  next30: { label: "Da 8 a 30 giorni", icon: CalendarCheck2, help: "Pianifica il lavoro delle prossime settimane." },
};

function AddDeadline({ onChanged }) {
  const [f, setF] = useState({ label: "", due_date: "", notify_days: DEFAULT_DAYS });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const add = async (e) => {
    e.preventDefault();
    setErr(""); setSaving(true);
    try {
      await ws.post("/deadlines", f);
      setF({ label: "", due_date: "", notify_days: DEFAULT_DAYS });
      onChanged();
    } catch (x) { setErr(errMsg(x)); }
    finally { setSaving(false); }
  };
  return (
    <form className="ws-dl-edit ws-deadline-add-form" onSubmit={add} data-testid="deadline-add-form">
      <label>Attività o adempimento
        <input className="as-input" aria-label="Descrizione della nuova scadenza"
          placeholder="Es. inviare dichiarazione al cliente" maxLength={200}
          value={f.label} onChange={e => setF({...f, label: e.target.value})}
          data-testid="deadline-add-label" required />
      </label>
      <div className="ws-deadline-field"><span>Data</span>
        <DateField value={f.due_date} onChange={v => setF({...f, due_date:v})}
          testid="deadline-add-date" />
      </div>
      <NotifyPicker value={f.notify_days} onChange={v => setF({...f,notify_days:v})} testid="deadline-add-notify" />
      <p className="ws-muted">Una nuova scadenza manuale viene confermata quando la salvi. Gli avvisi email dipendono dai giorni selezionati.</p>
      <button type="submit" className="as-btn as-btn-primary" disabled={saving || !f.label.trim() || !f.due_date}
        data-testid="deadline-add-btn">{saving ? "Salvataggio…" : "Aggiungi scadenza"}</button>
      {err && <div className="ws-error" role="alert">{err}</div>}
    </form>
  );
}

export default function Deadlines({ reloadKey, onChanged, onOpenDoc, tab, onTabChange, query, onQueryChange }) {
  const [b, setB] = useState(null);
  const [err, setErr] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  useEffect(() => {
    let live = true;
    ws.get("/deadlines").then(d => {
      if (live) { setB(d.buckets); setErr(""); }
    }).catch(e => { if (live) setErr(errMsg(e)); });
    return () => { live = false; };
  }, [reloadKey]);
  if (err) return <div className="ws-error" role="alert">{err}</div>;
  if (!b) return <div className="ws-muted">Caricamento scadenze…</div>;

  const buckets = Object.fromEntries(Object.entries(b).map(([key, list]) => [key, Array.isArray(list) ? list : []]));
  const inbox = BUCKET_ORDER.flatMap(key => buckets[key] || []);
  const counts = {
    inbox: inbox.length, overdue:(buckets.overdue || []).length, today:(buckets.today || []).length,
    next7:(buckets.next7 || []).length, next30:(buckets.next30 || []).length,
    to_verify:(buckets.to_verify || []).length, later:(buckets.later || []).length
  };
  const normalized = (query || "").trim().toLocaleLowerCase("it");
  const match = d => !normalized || [d.label,d.client_name,d.doc_type,d.kind_label,d.note,d.raw_date]
    .some(value => String(value || "").toLocaleLowerCase("it").includes(normalized));
  const selected = tab === "inbox" ? inbox : buckets[tab] || [];
  const visible = selected.filter(match);
  const byGroups = BUCKET_ORDER.map(key => ({
    key, ...URGENCY[key], items:(buckets[key] || []).filter(match)
  })).filter(group => group.items.length > 0);
  return (
    <div data-testid="deadlines-view">
      <div className="ws-bar ws-deadlines-top">
        <div>
          <h2 className="ws-h2">Agenda scadenze dello studio</h2>
          <p className="ws-muted">Date da controllare, adempimenti imminenti e promemoria in un'unica area di lavoro.</p>
        </div>
        <button type="button" className="as-btn as-btn-primary" aria-expanded={showAdd}
          onClick={() => setShowAdd(v => !v)} data-testid="deadline-add-toggle">
          <CalendarPlus2 size={17} aria-hidden="true" /> {showAdd ? "Chiudi nuova scadenza" : "Nuova scadenza"}
        </button>
      </div>
      {showAdd && <div className="ws-card ws-deadline-new" data-testid="deadline-new-panel">
        <h3 className="ws-h3">Aggiungi una scadenza manuale</h3>
        <AddDeadline onChanged={() => { onChanged(); setShowAdd(false); }} />
      </div>}
      <div className="ws-deadline-kpis" aria-label="Situazione scadenze">
        {[
          ["overdue","Scadute", "high"],
          ["today","Oggi", "medium"],
          ["to_verify","Da confermare", "medium"],
          ["next7","Prossimi 7 giorni", "low"]
        ].map(([key,label,tone]) => (
          <button key={key} type="button" className={"ws-deadline-kpi ws-deadline-kpi-"+tone}
            onClick={() => onTabChange(key)} aria-pressed={tab === key} data-testid={"deadline-kpi-"+key}>
            <span>{label}</span><strong>{counts[key]}</strong>
          </button>
        ))}
      </div>
      <div className="ws-deadline-explain">
        <span><ShieldCheck size={17} aria-hidden="true" /> <strong>Data da confermare:</strong> non usarla per un adempimento senza controllo professionale.</span>
        <span><Mail size={17} aria-hidden="true" /> <strong>Avvisi:</strong> sono diversi dalla conferma della data e non provano che l'attività sia stata svolta.</span>
      </div>
      <div className="ws-deadline-controls">
        <label className="ws-deadline-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Cerca fra le scadenze</span>
          <input type="search" className="as-input" value={query}
            onChange={e => onQueryChange(e.target.value)} placeholder="Cerca scadenza, cliente o documento"
            data-testid="deadline-search" />
        </label>
        <button type="button" className="as-btn" onClick={() => { onQueryChange(""); onTabChange("inbox"); }}
          data-testid="deadline-reset-filters"><Filter size={16} aria-hidden="true" /> Azzera filtri</button>
      </div>
      <div className="ws-tabs ws-deadline-tabs" role="group" aria-label="Filtra scadenze per periodo o stato">
        {BUCKETS.map(([key,label]) => (
          <button key={key} type="button" className={tab === key ? "on" : ""}
            aria-pressed={tab === key} onClick={() => onTabChange(key)}
            data-testid={"deadline-tab-"+key}>
            {label}{key === "review" ? "" : " (" + (counts[key] || 0) + ")"}
          </button>
        ))}
      </div>
      {tab === "review" ? <HistoricalReview reloadKey={reloadKey} onChanged={onChanged} query={query} /> : (
        <>
          <p className="ws-muted" role="status" data-testid="deadline-results-count">
            {visible.length} scadenze visualizzate. {tab === "inbox" ? "Ordinate per attività da gestire." : ""}
          </p>
          {visible.length === 0 && <p className="ws-deadline-empty" data-testid="deadlines-empty">
            {normalized ? "Nessuna scadenza corrisponde alla ricerca." : "Nessuna scadenza in questo gruppo."}
          </p>}
          {tab === "inbox" ? byGroups.map(group => {
            const Icon = group.icon;
            return (
              <section className="ws-deadline-group" key={group.key} data-testid={"deadline-group-"+group.key}>
                <div className="ws-deadline-group-head">
                  <Icon size={18} aria-hidden="true" />
                  <div><h3 className="ws-h3">{group.label} ({group.items.length})</h3>
                    <p className="ws-muted">{group.help}</p></div>
                </div>
                <DeadlineList items={group.items} onChanged={onChanged} onOpenDoc={onOpenDoc} />
              </section>
            );
          }) : <DeadlineList items={visible} onChanged={onChanged} onOpenDoc={onOpenDoc} />}
        </>
      )}
      <details className="ws-deadline-tools" data-testid="deadline-tools">
        <summary>Calendari, notifiche e impostazioni</summary>
        <p className="ws-muted">Esporta date confermate, gestisci l'abbonamento calendario e scegli se ricevere un riepilogo settimanale.</p>
        <CalendarExport />
        <DigestSettings />
      </details>
    </div>
  );
}
