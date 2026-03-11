import { useState, useEffect, useRef, useCallback } from "react";

const WORKER_BASE = "https://yahootracker.dhunganadinesh1.workers.dev";

const DEFAULT_TICKERS = [
  "BHP.AX", "CBA.AX", "RIO.AX", "WDS.AX",
  "FMG.AX", "NXT.AX", "ANZ.AX", "NCM.AX",
];

const NEWS = [
  { id: 1, time: "09:42", title: "BHP flags record iron ore shipments from Pilbara ports", tag: "BHP", sentiment: "up" },
  { id: 2, time: "09:15", title: "RBA holds cash rate steady at 4.35% amid inflation concerns", tag: "MACRO", sentiment: "neutral" },
  { id: 3, time: "08:53", title: "Woodside LNG exports surge as Asian demand hits 2026 highs", tag: "WDS", sentiment: "up" },
  { id: 4, time: "08:30", title: "ASX 200 opens lower following Wall Street sell-off overnight", tag: "ASX", sentiment: "down" },
  { id: 5, time: "07:58", title: "Rio Tinto copper division expansion approved by board", tag: "RIO", sentiment: "up" },
  { id: 6, time: "07:22", title: "CBA reports strong Q1 loan growth, beats analyst estimates", tag: "CBA", sentiment: "up" },
  { id: 7, time: "06:45", title: "Global oil prices rise 2.4% on Middle East supply concerns", tag: "ENERGY", sentiment: "up" },
  { id: 8, time: "06:10", title: "Iron ore futures slip 1.1% on softer Chinese steel demand data", tag: "MATERIALS", sentiment: "down" },
];

const SHIPS = [
  { id: 1, name: "MV Iron Pilbara", type: "Bulk Carrier", cargo: "Iron Ore", from: "Port Hedland", to: "Qingdao, CN", status: "Underway", relevance: "BHP / RIO" },
  { id: 2, name: "LNG Endeavour",   type: "LNG Tanker",   cargo: "LNG",      from: "Karratha, WA", to: "Tokyo, JP",   status: "Underway", relevance: "WDS" },
  { id: 3, name: "Pacific Bulker",  type: "Bulk Carrier", cargo: "Coal",     from: "Newcastle, NSW",to: "Busan, KR",   status: "Anchored", relevance: "Yancoal" },
  { id: 4, name: "Fortescue Star",  type: "Bulk Carrier", cargo: "Iron Ore", from: "Port Hedland", to: "Shanghai, CN", status: "Underway", relevance: "FMG" },
  { id: 5, name: "MV Copper Dawn",  type: "General Cargo",cargo: "Copper",   from: "Fremantle, WA", to: "Osaka, JP",  status: "Underway", relevance: "RIO" },
];

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchPrice(ticker) {
  try {
    const res  = await fetch(`${WORKER_BASE}/?ticker=${encodeURIComponent(ticker)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;
    return {
      price:     data.price     ?? null,
      change:    data.change    ?? 0,
      chartData: Array.isArray(data.chartData) ? data.chartData : [],
      volume:    data.volume    ?? 0,
    };
  } catch { return null; }
}

async function searchTickers(query) {
  const res  = await fetch(`${WORKER_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Search failed");
  return Array.isArray(data.results) ? data.results : [];
}

// ── Charts ────────────────────────────────────────────────────────────────────

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return <div style={{ width: 100, height: 36 }} />;
  const prices = data.map(d => d.price);
  const min = Math.min(...prices), max = Math.max(...prices), range = max - min || 1;
  const W = 100, H = 36;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * W},${H - ((d.price - min) / range) * H}`).join(" ");
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function MiniChart({ data, color, id }) {
  if (!data || data.length < 2) return <div style={{ height: 80, display: "flex", alignItems: "center", color: "#4a6fa5", fontSize: 11 }}>No chart data</div>;
  const prices = data.map(d => d.price);
  const min = Math.min(...prices) * 0.998, max = Math.max(...prices) * 1.002, range = max - min || 1;
  const W = 300, H = 80;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * W},${H - ((d.price - min) / range) * H}`).join(" ");
  const gid = `cg-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg: "#050d1a", panel: "#070f1f", border: "#0f2d4a",
  muted: "#4a6fa5", text: "#e2e8f0", accent: "#00d4ff",
  green: "#00ff88", red: "#ff4d6d", amber: "#f59e0b",
};

const S = {
  app:       { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: "13px" },
  header:    { background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo:      { color: C.accent, fontSize: "16px", fontWeight: "700", letterSpacing: "3px" },
  pulse:     { display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: C.green, marginRight: 8, animation: "pulse 2s infinite" },
  tape:      { background: "#040b17", borderBottom: `1px solid ${C.border}`, padding: "6px 24px", display: "flex", gap: 24, overflowX: "auto" },
  nav:       { display: "flex", gap: 4, background: C.panel, padding: "8px 24px", borderBottom: `1px solid ${C.border}` },
  navBtn:    a => ({ background: a ? "#00d4ff15" : "transparent", color: a ? C.accent : C.muted, border: a ? "1px solid #00d4ff30" : "1px solid transparent", padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "inherit" }),
  main:      { padding: 24, maxWidth: 1400, margin: "0 auto" },
  grid2:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  card:      { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 },
  cardTitle: { color: C.muted, fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 },
  row:       sel => ({ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 6, cursor: "pointer", background: sel ? "#00d4ff10" : "transparent", border: sel ? "1px solid #00d4ff20" : "1px solid transparent", marginBottom: 4 }),
  up:        { color: C.green },
  down:      { color: C.red },
  badge:     s => ({ fontSize: "9px", padding: "2px 6px", borderRadius: 3, background: s==="up"?"#00ff8815":s==="down"?"#ff4d6d15":"#94a3b815", color: s==="up"?C.green:s==="down"?C.red:"#94a3b8", border: `1px solid ${s==="up"?"#00ff8830":s==="down"?"#ff4d6d30":"#94a3b830"}` }),
  input:     { background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "6px 10px", borderRadius: 4, fontFamily: "inherit", fontSize: "12px" },
  select:    { background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "6px 10px", borderRadius: 4, fontFamily: "inherit", fontSize: "12px" },
  btn:       { background: "#00d4ff20", color: C.accent, border: "1px solid #00d4ff40", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: "11px" },
  btnSm:     { background: "#ff4d6d15", color: C.red, border: "1px solid #ff4d6d30", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: "10px" },
  alertRow:  { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0a1628", borderRadius: 6, marginBottom: 6, border: `1px solid ${C.border}` },
  shipRow:   { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` },
  dot:       s => ({ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: s==="Underway"?C.green:C.amber, marginRight: 6 }),
  dropdown:  { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: C.panel, border: `1px solid ${C.accent}30`, borderRadius: 6, zIndex: 200, boxShadow: "0 8px 32px #00000060" },
};

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab]                         = useState("watchlist");
  const [stocks, setStocks]                   = useState([]);
  const [selectedTicker, setSelectedTicker]   = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [loadingStatus, setLoadingStatus]     = useState("");
  const [lastUpdated, setLastUpdated]         = useState(null);

  // Search
  const [searchQuery, setSearchQuery]         = useState("");
  const [searchResults, setSearchResults]     = useState([]);
  const [searching, setSearching]             = useState(false);
  const [searchError, setSearchError]         = useState("");
  const [addingTicker, setAddingTicker]       = useState(null);
  const searchTimerRef                        = useRef(null);
  const searchReqRef                          = useRef(0);
  const searchBoxRef                          = useRef(null);

  // Alerts
  const [alerts, setAlerts]                   = useState([]);
  const [newAlert, setNewAlert]               = useState({ ticker: DEFAULT_TICKERS[0], condition: "above", price: "" });
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);

  const watchlistRef  = useRef(DEFAULT_TICKERS.map(t => ({ ticker: t, name: t.replace(".AX", "") })));
  const selectedStock = stocks.find(s => s.ticker === selectedTicker) ?? stocks[0] ?? null;
  const priceColor    = s => s.change >= 0 ? C.green : C.red;

  // ── Load / refresh stocks ─────────────────────────────────────────────────
  const loadStocks = useCallback(async (defs) => {
    setLoading(true);
    const results = [];
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      setLoadingStatus(`Fetching ${def.ticker} (${i + 1}/${defs.length})…`);
      const data = await fetchPrice(def.ticker);
      results.push(data
        ? { ...def, ...data }
        : { ...def, price: null, change: 0, volume: 0, chartData: [], error: true }
      );
    }
    setStocks(results);
    setLastUpdated(new Date());
    setLoadingStatus("");
    setLoading(false);
  }, []);

  useEffect(() => { loadStocks(watchlistRef.current); }, [loadStocks]);
  useEffect(() => {
    const id = setInterval(() => loadStocks(watchlistRef.current), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadStocks]);

  // Keep alert ticker valid
  useEffect(() => {
    if (stocks.length && !stocks.find(s => s.ticker === newAlert.ticker))
      setNewAlert(p => ({ ...p, ticker: stocks[0].ticker }));
  }, [stocks, newAlert.ticker]);

  // ── Alert triggers ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!stocks.length || !alerts.length) return;
    alerts.forEach(alert => {
      const stock = stocks.find(s => s.ticker === alert.ticker);
      if (!stock?.price) return;
      const hit = (alert.condition === "above" && stock.price >= alert.price)
               || (alert.condition === "below" && stock.price <= alert.price);
      if (hit) {
        setTriggeredAlerts(prev => {
          if (prev.find(t => t.id === alert.id)) return prev;
          return [...prev, { ...alert, triggeredAt: new Date().toLocaleTimeString(), currentPrice: stock.price }];
        });
      }
    });
  }, [stocks, alerts]);

  // ── Search (debounced, calls /search on worker) ───────────────────────────
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    setSearchError("");
    clearTimeout(searchTimerRef.current);

    if (!query.trim()) { setSearchResults([]); setSearching(false); return; }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const reqId = ++searchReqRef.current;
      try {
        const results = await searchTickers(query);
        if (reqId !== searchReqRef.current) return;
        const current = new Set(watchlistRef.current.map(s => s.ticker));
        setSearchResults(results.filter(r => !current.has(r.ticker)).slice(0, 7));
      } catch (err) {
        if (reqId !== searchReqRef.current) return;
        setSearchResults([]);
        setSearchError(err.message || "Search failed");
      } finally {
        if (reqId === searchReqRef.current) setSearching(false);
      }
    }, 350);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setSearchResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Add stock from search result ──────────────────────────────────────────
  const addStock = useCallback(async (def) => {
    if (watchlistRef.current.find(s => s.ticker === def.ticker)) return;
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setAddingTicker(def.ticker);

    const data = await fetchPrice(def.ticker);
    const entry = data
      ? { ...def, ...data }
      : { ...def, price: null, change: 0, volume: 0, chartData: [], error: true };

    watchlistRef.current = [...watchlistRef.current, def];
    setStocks(prev => [...prev, entry]);
    setSelectedTicker(def.ticker);
    setAddingTicker(null);
  }, []);

  // ── Remove stock ──────────────────────────────────────────────────────────
  const removeStock = useCallback((ticker) => {
    watchlistRef.current = watchlistRef.current.filter(s => s.ticker !== ticker);
    setStocks(prev => {
      const next = prev.filter(s => s.ticker !== ticker);
      setSelectedTicker(cur => cur === ticker ? (next[0]?.ticker ?? null) : cur);
      return next;
    });
  }, []);

  // ── Alert helpers ─────────────────────────────────────────────────────────
  const addAlert         = () => {
    if (!newAlert.price) return;
    setAlerts(prev => [...prev, { ...newAlert, id: Date.now(), price: parseFloat(newAlert.price), active: true }]);
    setNewAlert(p => ({ ...p, price: "" }));
  };
  const removeAlert      = id  => setAlerts(prev => prev.filter(a => a.id !== id));
  const dismissTriggered = idx => setTriggeredAlerts(prev => prev.filter((_, i) => i !== idx));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#050d1a} ::-webkit-scrollbar-thumb{background:#0f2d4a}
        .nav-wrap{display:flex;gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch;}
        .nav-wrap::-webkit-scrollbar{display:none}
        @media(max-width:700px){
          .grid2{grid-template-columns:1fr!important}
          .main-pad{padding:10px!important}
          .hide-sm{display:none!important}
        }
      `}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.logo}>⬡ ASX INTEL</div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {loading
            ? <span style={{ color:C.amber, fontSize:"11px" }}>⟳ {loadingStatus||"Loading…"}</span>
            : <span style={{ color:C.muted, fontSize:"11px" }}><span style={S.pulse}/>~15min delay · {lastUpdated?.toLocaleTimeString()}</span>
          }
          <button style={{ ...S.btn, fontSize:"10px", padding:"4px 10px" }} onClick={() => loadStocks(watchlistRef.current)}>
            ↺ REFRESH
          </button>
        </div>
      </div>

      {/* ── Ticker tape ── */}
      <div style={S.tape}>
        {loading
          ? <span style={{ color:C.muted, fontSize:"11px" }}>{loadingStatus||"Fetching ASX prices…"}</span>
          : stocks.map(s => (
              <span key={s.ticker} style={{ whiteSpace:"nowrap", fontSize:"11px" }}>
                <span style={{ color:C.muted }}>{s.ticker.replace(".AX","")} </span>
                {s.error||!s.price
                  ? <span style={{ color:C.amber }}>N/A </span>
                  : <><span style={{ color:C.text }}>${s.price.toFixed(2)} </span>
                     <span style={s.change>=0?S.up:S.down}>{s.change>=0?"▲":"▼"}{Math.abs(s.change)}%</span></>
                }
              </span>
            ))
        }
      </div>

      {/* ── Nav ── */}
      <div style={S.nav} className="nav-wrap">
        {[["watchlist","WATCHLIST"],["charts","CHARTS"],["news","NEWS"],["ships","SHIPS"],["alerts","ALERTS"]].map(([key,label]) => (
          <button key={key} style={S.navBtn(tab===key)} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* ── Alert banners ── */}
      {triggeredAlerts.length > 0 && (
        <div style={{ padding:"8px 24px" }}>
          {triggeredAlerts.map((a, i) => (
            <div key={i} style={{ background:"#ff4d6d10", border:"1px solid #ff4d6d40", borderRadius:6, padding:"10px 14px", marginBottom:8, display:"flex", justifyContent:"space-between" }}>
              <span>🔔 <strong style={{ color:C.red }}>ALERT</strong> — {a.ticker.replace(".AX","")} {a.condition} ${a.price.toFixed(2)} · Now ${a.currentPrice?.toFixed(2)??"?"} · {a.triggeredAt}</span>
              <button style={S.btnSm} onClick={() => dismissTriggered(i)}>DISMISS</button>
            </div>
          ))}
        </div>
      )}

      <div style={S.main} className="main-pad">

        {/* ════ WATCHLIST ════ */}
        {tab === "watchlist" && (
          <div style={S.grid2} className="grid2">

            <div style={S.card}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                <span style={S.cardTitle}>ASX Watchlist</span>
                <span style={{ color:C.muted, fontSize:"10px" }}>Worker + Yahoo Finance · ~15min delay</span>
              </div>

              {/* ── Search box ── */}
              <div ref={searchBoxRef} style={{ position:"relative", marginBottom:16 }}>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:C.muted, pointerEvents:"none" }}>⌕</span>
                  <input
                    style={{ ...S.input, width:"100%", paddingLeft:30 }}
                    placeholder="Search ASX company or ticker…"
                    value={searchQuery}
                    onChange={e => handleSearch(e.target.value)}
                    onFocus={() => searchQuery.trim() && handleSearch(searchQuery)}
                  />
                  {searching && (
                    <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", color:C.amber, fontSize:11 }}>⟳</span>
                  )}
                </div>

                {/* Status messages */}
                {searchError && (
                  <div style={{ color:C.red, fontSize:11, padding:"6px 2px" }}>{searchError}</div>
                )}
                {addingTicker && (
                  <div style={{ color:C.amber, fontSize:11, padding:"6px 2px" }}>⟳ Adding {addingTicker}…</div>
                )}

                {/* Dropdown results */}
                {searchResults.length > 0 && (
                  <div style={S.dropdown}>
                    {searchResults.map((r, idx) => (
                      <div
                        key={r.ticker}
                        onClick={() => addStock(r)}
                        style={{ padding:"10px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom: idx < searchResults.length-1 ? `1px solid ${C.border}` : "none" }}
                        onMouseEnter={e => e.currentTarget.style.background="#00d4ff08"}
                        onMouseLeave={e => e.currentTarget.style.background="transparent"}
                      >
                        <div>
                          <span style={{ color:C.accent, fontWeight:600 }}>{r.ticker.replace(".AX","")}</span>
                          <span style={{ color:C.muted, marginLeft:10, fontSize:11 }}>{r.name}</span>
                        </div>
                        <span style={{ color:C.green, fontSize:10, flexShrink:0, marginLeft:8 }}>+ ADD</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* No results */}
                {!searching && !searchError && searchQuery.trim() && searchResults.length === 0 && (
                  <div style={{ color:C.muted, fontSize:11, padding:"6px 2px" }}>
                    No ASX results for "{searchQuery}" — try a ticker code directly (e.g. WES)
                  </div>
                )}
              </div>

              {/* Stock rows */}
              {loading
                ? <div style={{ color:C.muted, padding:20, textAlign:"center" }}>⟳ {loadingStatus}</div>
                : stocks.map(s => (
                    <div key={s.ticker} style={S.row(selectedStock?.ticker===s.ticker)} onClick={() => setSelectedTicker(s.ticker)}>
                      <div style={{ minWidth:80 }}>
                        <div style={{ color:C.text, fontWeight:600 }}>{s.ticker.replace(".AX","")}</div>
                        <div style={{ color:C.muted, fontSize:11 }}>{s.name}</div>
                      </div>
                      <div style={{ textAlign:"right", minWidth:80 }}>
                        {s.error||!s.price
                          ? <div style={{ color:C.amber, fontSize:11 }}>N/A</div>
                          : <><div style={{ color:C.text }}>${s.price.toFixed(2)}</div>
                             <div style={s.change>=0?S.up:S.down}>{s.change>=0?"▲":"▼"} {Math.abs(s.change)}%</div></>
                        }
                      </div>
                      <span className="hide-sm" style={{ flex:1 }}>
                        <Sparkline data={s.chartData} color={priceColor(s)} />
                      </span>
                      <button onClick={e => { e.stopPropagation(); removeStock(s.ticker); }}
                        style={{ background:"transparent", border:"none", color:C.muted, cursor:"pointer", fontSize:14, padding:"0 4px", flexShrink:0 }}>✕</button>
                    </div>
                  ))
              }
            </div>

            {/* Detail panel */}
            {selectedStock && (
              <div style={S.card}>
                <div style={S.cardTitle}>Detail — {selectedStock.ticker}</div>
                {selectedStock.error||!selectedStock.price ? (
                  <div>
                    <div style={{ color:C.amber, marginBottom:12 }}>Could not load price data.</div>
                    <div style={{ color:C.muted, fontSize:11, lineHeight:1.8 }}>
                      · Worker could not fetch Yahoo Finance data<br/>
                      · Ticker may be incorrect or temporarily unavailable<br/>
                      · Try ↺ REFRESH in the header
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:28, color:C.text, fontWeight:700 }}>${selectedStock.price.toFixed(2)}</div>
                      <div style={{ ...(selectedStock.change>=0?S.up:S.down), fontSize:14 }}>
                        {selectedStock.change>=0?"▲":"▼"} {Math.abs(selectedStock.change)}% today
                      </div>
                      <div style={{ color:C.muted, fontSize:10, marginTop:4 }}>~15 min delayed · Worker / Yahoo Finance</div>
                    </div>
                    <div style={{ marginBottom:16 }}>
                      <MiniChart data={selectedStock.chartData} color={priceColor(selectedStock)} id={selectedStock.ticker} />
                      <div style={{ color:C.muted, fontSize:10, marginTop:4 }}>30-day price history</div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                      {[
                        ["Volume",   selectedStock.volume ? `${(selectedStock.volume/1e6).toFixed(1)}M` : "N/A"],
                        ["Exchange", "ASX"],
                        ["Currency", "AUD"],
                        ["Ticker",   selectedStock.ticker],
                      ].map(([label, val]) => (
                        <div key={label} style={{ background:C.bg, borderRadius:6, padding:"8px 12px" }}>
                          <div style={{ color:C.muted, fontSize:10, marginBottom:2 }}>{label}</div>
                          <div style={{ color:C.text }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════ CHARTS ════ */}
        {tab === "charts" && (
          <div style={S.grid2} className="grid2">
            {loading
              ? <div style={{ ...S.card, color:C.muted }}>⟳ {loadingStatus}</div>
              : stocks.map(s => (
                  <div key={s.ticker} style={S.card}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                      <div>
                        <span style={{ color:C.text, fontWeight:600 }}>{s.ticker.replace(".AX","")}</span>
                        <span style={{ color:C.muted, fontSize:11, marginLeft:8 }}>{s.name}</span>
                      </div>
                      {s.error||!s.price
                        ? <span style={{ color:C.amber, fontSize:11 }}>N/A</span>
                        : <div style={s.change>=0?S.up:S.down}>${s.price.toFixed(2)} {s.change>=0?"▲":"▼"}{Math.abs(s.change)}%</div>
                      }
                    </div>
                    <MiniChart data={s.chartData} color={priceColor(s)} id={s.ticker} />
                    <div style={{ color:C.muted, fontSize:10, marginTop:6 }}>30-day history · Worker / Yahoo Finance</div>
                  </div>
                ))
            }
          </div>
        )}

        {/* ════ NEWS ════ */}
        {tab === "news" && (
          <div style={S.card}>
            <div style={S.cardTitle}>ASX News & Announcements</div>
            {NEWS.map(n => (
              <div key={n.id} style={{ padding:"14px 0", borderBottom:`1px solid ${C.border}`, display:"flex", gap:14 }}>
                <div style={{ color:C.muted, fontSize:11, minWidth:40 }}>{n.time}</div>
                <div style={{ flex:1 }}>
                  <div style={{ color:C.text, marginBottom:6, lineHeight:1.5 }}>{n.title}</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <span style={{ ...S.badge("neutral"), background:"#00d4ff10", color:C.accent, border:"1px solid #00d4ff20" }}>{n.tag}</span>
                    <span style={S.badge(n.sentiment)}>{n.sentiment==="up"?"▲ POSITIVE":n.sentiment==="down"?"▼ NEGATIVE":"● NEUTRAL"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ════ SHIPS ════ */}
        {tab === "ships" && (
          <div style={S.grid2} className="grid2">
            <div style={S.card}>
              <div style={S.cardTitle}>Vessel Intelligence — Australian Ports</div>
              {SHIPS.map(ship => (
                <div key={ship.id} style={S.shipRow}>
                  <div style={{ flex:1 }}>
                    <div style={{ color:C.text, fontWeight:600, marginBottom:3 }}><span style={S.dot(ship.status)}/>{ship.name}</div>
                    <div style={{ color:C.muted, fontSize:11 }}>{ship.type} · {ship.cargo}</div>
                    <div style={{ color:C.muted, fontSize:11, marginTop:2 }}>{ship.from} → {ship.to}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ ...S.badge(ship.status==="Underway"?"up":"neutral"), marginBottom:4 }}>{ship.status}</div>
                    <div style={{ color:C.accent, fontSize:10 }}>{ship.relevance}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>Signal Intelligence</div>
              {[
                { color:C.accent,   label:"IRON ORE SIGNAL", text:"3 bulk carriers departing Pilbara ports this week. Positive signal for BHP, RIO, FMG." },
                { color:C.amber,    label:"LNG SIGNAL",       text:"LNG tanker volume from Karratha up 12% vs last month. Supports WDS revenue outlook." },
                { color:"#94a3b8",  label:"COAL SIGNAL",      text:"Newcastle bulk carriers anchored — slight delay in exports. Watch coal prices." },
              ].map(sig => (
                <div key={sig.label} style={{ background:C.bg, borderRadius:6, padding:12, marginBottom:10, fontSize:11, color:C.muted, lineHeight:1.7 }}>
                  <div style={{ color:sig.color, marginBottom:6 }}>● {sig.label}</div>
                  <div>{sig.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ ALERTS ════ */}
        {tab === "alerts" && (
          <div style={S.grid2} className="grid2">
            <div style={S.card}>
              <div style={S.cardTitle}>Active Alerts</div>
              <div style={{ color:C.muted, fontSize:10, marginBottom:12 }}>Alerts check on each price refresh</div>
              {alerts.length===0 && <div style={{ color:C.muted }}>No alerts set.</div>}
              {alerts.map(a => (
                <div key={a.id} style={S.alertRow}>
                  <div>
                    <span style={{ color:C.accent }}>{a.ticker.replace(".AX","")}</span>
                    <span style={{ color:C.muted, margin:"0 8px" }}>price</span>
                    <span style={a.condition==="above"?S.up:S.down}>{a.condition.toUpperCase()}</span>
                    <span style={{ color:C.text, marginLeft:8 }}>${a.price.toFixed(2)}</span>
                  </div>
                  <button style={S.btnSm} onClick={() => removeAlert(a.id)}>REMOVE</button>
                </div>
              ))}
              <div style={{ marginTop:20 }}>
                <div style={S.cardTitle}>Add New Alert</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <select style={S.select} value={newAlert.ticker} onChange={e => setNewAlert(p => ({ ...p, ticker:e.target.value }))}>
                    {stocks.map(s => <option key={s.ticker} value={s.ticker}>{s.ticker.replace(".AX","")}</option>)}
                  </select>
                  <select style={S.select} value={newAlert.condition} onChange={e => setNewAlert(p => ({ ...p, condition:e.target.value }))}>
                    <option value="above">ABOVE</option>
                    <option value="below">BELOW</option>
                  </select>
                  <input style={{ ...S.input, width:90 }} type="number" placeholder="Price"
                    value={newAlert.price} onChange={e => setNewAlert(p => ({ ...p, price:e.target.value }))} />
                  <button style={S.btn} onClick={addAlert}>+ ADD ALERT</button>
                </div>
              </div>
            </div>
            <div style={S.card}>
              <div style={S.cardTitle}>Triggered Alerts History</div>
              {triggeredAlerts.length===0 && <div style={{ color:C.muted }}>No alerts triggered yet.</div>}
              {triggeredAlerts.map((a, i) => (
                <div key={i} style={{ ...S.alertRow, borderColor:"#ff4d6d30", background:"#ff4d6d08" }}>
                  <div>
                    <span style={{ color:C.red }}>🔔 {a.ticker.replace(".AX","")}</span>
                    <span style={{ color:C.muted, margin:"0 6px" }}>{a.condition}</span>
                    <span style={{ color:C.text }}>${a.price.toFixed(2)}</span>
                    <span style={{ color:C.muted, fontSize:10, marginLeft:8 }}>@ {a.triggeredAt}</span>
                  </div>
                  <button style={S.btnSm} onClick={() => dismissTriggered(i)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
