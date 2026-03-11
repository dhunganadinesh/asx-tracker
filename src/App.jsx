import { useState, useEffect, useRef } from "react";

const WORKER_BASE = "https://yahootracker.dhunganadinesh1.workers.dev";

const DEFAULT_TICKERS = [
  "BHP.AX",
  "CBA.AX",
  "RIO.AX",
  "WDS.AX",
  "FMG.AX",
  "NXT.AX",
  "ANZ.AX",
  "NCM.AX",
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
  { id: 2, name: "LNG Endeavour", type: "LNG Tanker", cargo: "LNG", from: "Karratha, WA", to: "Tokyo, JP", status: "Underway", relevance: "WDS" },
  { id: 3, name: "Pacific Bulker", type: "Bulk Carrier", cargo: "Coal", from: "Newcastle, NSW", to: "Busan, KR", status: "Anchored", relevance: "Yancoal" },
  { id: 4, name: "Fortescue Star", type: "Bulk Carrier", cargo: "Iron Ore", from: "Port Hedland", to: "Shanghai, CN", status: "Underway", relevance: "FMG" },
  { id: 5, name: "MV Copper Dawn", type: "General Cargo", cargo: "Copper", from: "Fremantle, WA", to: "Osaka, JP", status: "Underway", relevance: "RIO" },
];

async function fetchPrice(ticker) {
  try {
    const res = await fetch(
      WORKER_BASE + "/quote?ticker=" + encodeURIComponent(ticker)
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.ok) return null;

    return {
      price: data.price,
      change: data.change,
      chartData: data.chartData || [],
      volume: data.volume || 0,
      source: "worker",
    };
  } catch (e) {
    return null;
  }
}

async function searchStocksRemote(query) {
  const res = await fetch(
    WORKER_BASE + "/search?q=" + encodeURIComponent(query)
  );

  if (!res.ok) {
    throw new Error("Search request failed: " + res.status);
  }

  const data = await res.json();

  const list =
    Array.isArray(data) ? data :
    Array.isArray(data.results) ? data.results :
    Array.isArray(data.data) ? data.data :
    Array.isArray(data.tickers) ? data.tickers :
    [];

  if (!list.length) {
    console.log("Search response from worker:", data);
    return [];
  }

  return list.map(function(item) {
    if (typeof item === "string") {
      return {
        ticker: item.endsWith(".AX") ? item : item + ".AX",
        name: item.replace(".AX", ""),
        sector: "Unknown"
      };
    }

    return {
      ticker:
        item.yahooTicker ||
        item.ticker ||
        (item.asxCode ? item.asxCode + ".AX" : ""),
      name:
        item.name ||
        item.companyName ||
        item.company ||
        item.asxCode ||
        "Unknown",
      sector:
        item.sector ||
        item.industry ||
        "Unknown"
    };
  }).filter(function(item) {
    return item.ticker;
  });
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const prices = data.map(function(d) { return d.price; });
  const min = Math.min.apply(null, prices);
  const max = Math.max.apply(null, prices);
  const range = max - min || 1;
  const w = 100, h = 36;
  const points = data.map(function(d, i) {
    return ((i / (data.length - 1)) * w) + "," + (h - ((d.price - min) / range) * h);
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function MiniChart({ data, color, id }) {
  if (!data || data.length < 2) return null;
  const prices = data.map(function(d) { return d.price; });
  const min = Math.min.apply(null, prices) * 0.998;
  const max = Math.max.apply(null, prices) * 1.002;
  const range = max - min || 1;
  const w = 300, h = 80;
  const pts = data.map(function(d, i) {
    return ((i / (data.length - 1)) * w) + "," + (h - ((d.price - min) / range) * h);
  }).join(" ");
  const gradientId = "cg-" + id.replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg width="100%" viewBox={"0 0 " + w + " " + h} style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={"0," + h + " " + pts + " " + w + "," + h} fill={"url(#" + gradientId + ")"} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  const [tab, setTab] = useState("watchlist");
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [newAlert, setNewAlert] = useState({ ticker: "BHP.AX", condition: "above", price: "" });
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [fetchingTicker, setFetchingTicker] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchReqIdRef = useRef(0);

  const watchlistRef = useRef(DEFAULT_TICKERS.map(function(t) {
    return {
      ticker: t,
      name: t.replace(".AX", ""),
      sector: "Unknown",
    };
  }));

  async function loadStocks(defs) {
    setLoading(true);
    const results = [];
    for (var i = 0; i < defs.length; i++) {
      var def = defs[i];
      setLoadingStatus("Fetching " + def.ticker + " (" + (i + 1) + "/" + defs.length + ")...");
      var data = await fetchPrice(def.ticker);
      if (data) {
        results.push(Object.assign({}, def, data));
      } else {
        results.push(Object.assign({}, def, {
          price: null,
          change: 0,
          volume: 0,
          chartData: [],
          error: true,
        }));
      }
    }
    setStocks(results);
    setSelectedStock(function(prev) {
      if (!results.length) return null;
      if (!prev) return results[0];
      var updated = results.find(function(s) { return s.ticker === prev.ticker; });
      return updated || results[0];
    });
    setLastUpdated(new Date());
    setLoadingStatus("");
    setLoading(false);
  }

  useEffect(function() {
    loadStocks(watchlistRef.current);
  }, []);

  useEffect(function() {
    var interval = setInterval(function() {
      loadStocks(watchlistRef.current);
    }, 5 * 60 * 1000);
    return function() { clearInterval(interval); };
  }, []);

  async function handleSearch(query) {
    setSearchQuery(query);
    setSearchError("");

    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const reqId = ++searchReqIdRef.current;
    setSearching(true);

    try {
      const results = await searchStocksRemote(query);

      if (reqId !== searchReqIdRef.current) return;

      const filtered = results.filter(function(s) {
        return !stocks.find(function(w) { return w.ticker === s.ticker; });
      }).slice(0, 6);

      setSearchResults(filtered);
    } catch (err) {
      if (reqId !== searchReqIdRef.current) return;
      setSearchResults([]);
      setSearchError(err.message || "Search failed");
    } finally {
      if (reqId === searchReqIdRef.current) {
        setSearching(false);
      }
    }
  }

  async function addStock(def) {
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setFetchingTicker(def.ticker);

    var data = await fetchPrice(def.ticker);
    var newStock = data
      ? Object.assign({}, def, data)
      : Object.assign({}, def, {
          price: null,
          change: 0,
          volume: 0,
          chartData: [],
          error: true,
        });

    watchlistRef.current = watchlistRef.current.concat([def]);
    setStocks(function(prev) { return prev.concat([newStock]); });
    setSelectedStock(newStock);
    setFetchingTicker(null);
  }

  function removeStock(ticker) {
    watchlistRef.current = watchlistRef.current.filter(function(s) { return s.ticker !== ticker; });
    setStocks(function(prev) { return prev.filter(function(s) { return s.ticker !== ticker; }); });
    setSelectedStock(function(prev) {
      if (!prev || prev.ticker !== ticker) return prev;
      var next = stocks.filter(function(s) { return s.ticker !== ticker; });
      return next[0] || null;
    });
  }

  function addAlert() {
    if (!newAlert.price) return;
    setAlerts(function(prev) {
      return prev.concat([Object.assign({}, newAlert, {
        id: Date.now(),
        price: parseFloat(newAlert.price),
        active: true,
      })]);
    });
    setNewAlert(function(prev) {
      return Object.assign({}, prev, { price: "" });
    });
  }

  function removeAlert(id) {
    setAlerts(function(prev) { return prev.filter(function(a) { return a.id !== id; }); });
  }

  function dismissTriggered(idx) {
    setTriggeredAlerts(function(prev) { return prev.filter(function(_, i) { return i !== idx; }); });
  }

  useEffect(function() {
    if (!stocks.length || !alerts.length) return;

    alerts.forEach(function(alert) {
      var stock = stocks.find(function(s) { return s.ticker === alert.ticker; });
      if (!stock || !stock.price) return;

      if (alert.condition === "above" && stock.price >= alert.price) {
        setTriggeredAlerts(function(prev) {
          if (prev.find(function(t) { return t.id === alert.id; })) return prev;
          return prev.concat([Object.assign({}, alert, {
            triggeredAt: new Date().toLocaleTimeString(),
            currentPrice: stock.price,
          })]);
        });
      }

      if (alert.condition === "below" && stock.price <= alert.price) {
        setTriggeredAlerts(function(prev) {
          if (prev.find(function(t) { return t.id === alert.id; })) return prev;
          return prev.concat([Object.assign({}, alert, {
            triggeredAt: new Date().toLocaleTimeString(),
            currentPrice: stock.price,
          })]);
        });
      }
    });
  }, [stocks, alerts]);

  useEffect(function() {
    if (selectedStock) {
      var updated = stocks.find(function(s) { return s.ticker === selectedStock.ticker; });
      if (updated) setSelectedStock(updated);
    }
  }, [stocks]);

  useEffect(function() {
    if (stocks.length && !stocks.find(function(s) { return s.ticker === newAlert.ticker; })) {
      setNewAlert(function(prev) {
        return Object.assign({}, prev, { ticker: stocks[0].ticker });
      });
    }
  }, [stocks]);

  const S = {
    app: { minHeight: "100vh", background: "#050d1a", color: "#e2e8f0", fontFamily: "'IBM Plex Mono','Courier New',monospace", fontSize: "13px" },
    header: { background: "#070f1f", borderBottom: "1px solid #0f2d4a", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    logo: { color: "#00d4ff", fontSize: "16px", fontWeight: "700", letterSpacing: "3px" },
    pulse: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#00ff88", marginRight: 8, animation: "pulse 2s infinite" },
    nav: { display: "flex", gap: 4, background: "#070f1f", padding: "8px 24px", borderBottom: "1px solid #0f2d4a" },
    navBtn: function(a) {
      return {
        background: a ? "#00d4ff15" : "transparent",
        color: a ? "#00d4ff" : "#4a6fa5",
        border: a ? "1px solid #00d4ff30" : "1px solid transparent",
        padding: "6px 16px",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: "11px",
        letterSpacing: "1px",
        textTransform: "uppercase",
        fontFamily: "inherit",
      };
    },
    main: { padding: 24, maxWidth: 1400, margin: "0 auto" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    card: { background: "#070f1f", border: "1px solid #0f2d4a", borderRadius: 8, padding: 16 },
    cardTitle: { color: "#4a6fa5", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 },
    row: function(sel) {
      return {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 6,
        cursor: "pointer",
        background: sel ? "#00d4ff10" : "transparent",
        border: sel ? "1px solid #00d4ff20" : "1px solid transparent",
        marginBottom: 4,
      };
    },
    up: { color: "#00ff88" },
    down: { color: "#ff4d6d" },
    badge: function(s) {
      return {
        fontSize: "9px",
        padding: "2px 6px",
        borderRadius: 3,
        background: s === "up" ? "#00ff8815" : s === "down" ? "#ff4d6d15" : "#94a3b815",
        color: s === "up" ? "#00ff88" : s === "down" ? "#ff4d6d" : "#94a3b8",
        border: "1px solid " + (s === "up" ? "#00ff8830" : s === "down" ? "#ff4d6d30" : "#94a3b830"),
      };
    },
    input: { background: "#050d1a", border: "1px solid #0f2d4a", color: "#e2e8f0", padding: "6px 10px", borderRadius: 4, fontFamily: "inherit", fontSize: "12px" },
    select: { background: "#050d1a", border: "1px solid #0f2d4a", color: "#e2e8f0", padding: "6px 10px", borderRadius: 4, fontFamily: "inherit", fontSize: "12px" },
    btn: { background: "#00d4ff20", color: "#00d4ff", border: "1px solid #00d4ff40", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: "11px" },
    btnSm: { background: "#ff4d6d15", color: "#ff4d6d", border: "1px solid #ff4d6d30", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: "10px" },
    alertRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0a1628", borderRadius: 6, marginBottom: 6, border: "1px solid #0f2d4a" },
    shipRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0f2d4a" },
    dot: function(s) {
      return {
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: s === "Underway" ? "#00ff88" : "#f59e0b",
        marginRight: 6,
      };
    },
  };

  const priceColor = function(s) { return s.change >= 0 ? "#00ff88" : "#ff4d6d"; };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { -webkit-text-size-adjust: 100%; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#050d1a} ::-webkit-scrollbar-thumb{background:#0f2d4a}
        .nav-wrap { display: flex; gap: 4px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .nav-wrap::-webkit-scrollbar { display: none; }
        @media (max-width: 700px) {
          .grid2 { grid-template-columns: 1fr !important; }
          .main-pad { padding: 10px !important; }
          .card-inner { padding: 12px !important; }
          .hide-sm { display: none !important; }
          .search-input { font-size: 16px !important; }
        }
      `}</style>

      <div style={S.header}>
        <div style={S.logo}>⬡ ASX INTEL</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {loading
            ? <span style={{ color: "#f59e0b", fontSize: "11px" }}>⟳ {loadingStatus || "Loading..."}</span>
            : <span style={{ color: "#4a6fa5", fontSize: "11px" }}><span style={S.pulse}></span>~15min delay · {lastUpdated ? lastUpdated.toLocaleTimeString() : ""}</span>
          }
          <button
            style={Object.assign({}, S.btn, { fontSize: "10px", padding: "4px 10px" })}
            onClick={function() { loadStocks(watchlistRef.current); }}
          >
            ↺ REFRESH
          </button>
        </div>
      </div>

      <div style={{ background: "#040b17", borderBottom: "1px solid #0f2d4a", padding: "6px 24px", display: "flex", gap: 24, overflowX: "auto" }}>
        {loading
          ? <span style={{ color: "#4a6fa5", fontSize: "11px" }}>{loadingStatus || "Fetching ASX prices..."}</span>
          : stocks.map(function(s) {
              return (
                <span key={s.ticker} style={{ whiteSpace: "nowrap", fontSize: "11px" }}>
                  <span style={{ color: "#4a6fa5" }}>{s.ticker.replace(".AX", "")} </span>
                  {s.error || !s.price
                    ? <span style={{ color: "#f59e0b" }}>N/A </span>
                    : (
                      <>
                        <span style={{ color: "#e2e8f0" }}>${s.price.toFixed(2)} </span>
                        <span style={s.change >= 0 ? S.up : S.down}>
                          {s.change >= 0 ? "▲" : "▼"}{Math.abs(s.change)}%
                        </span>
                      </>
                    )
                  }
                </span>
              );
            })
        }
      </div>

      <div style={S.nav} className="nav-wrap">
        {[["watchlist","WATCHLIST"],["charts","CHARTS"],["news","NEWS"],["ships","SHIPS"],["alerts","ALERTS"]].map(function(item) {
          return (
            <button key={item[0]} style={S.navBtn(tab === item[0])} onClick={function() { setTab(item[0]); }}>
              {item[1]}
            </button>
          );
        })}
      </div>

      {triggeredAlerts.length > 0 && (
        <div style={{ padding: "8px 24px" }}>
          {triggeredAlerts.map(function(a, i) {
            return (
              <div key={i} style={{ background: "#ff4d6d10", border: "1px solid #ff4d6d40", borderRadius: 6, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span>🔔 <strong style={{ color: "#ff4d6d" }}>ALERT</strong> — {a.ticker.replace(".AX","")} {a.condition} ${a.price.toFixed(2)} · Now ${a.currentPrice ? a.currentPrice.toFixed(2) : "?"} · {a.triggeredAt}</span>
                <button style={S.btnSm} onClick={function() { dismissTriggered(i); }}>DISMISS</button>
              </div>
            );
          })}
        </div>
      )}

      <div style={S.main} className="main-pad">
        {tab === "watchlist" && (
          <div className="grid2">
            <div style={S.card} className="card-inner">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={S.cardTitle}>ASX Watchlist</span>
                <span style={{ color: "#4a6fa5", fontSize: "10px" }}>Worker + Yahoo Finance · ~15min delay</span>
              </div>

              <div style={{ position: "relative", marginBottom: 12 }}>
                <input
                  style={Object.assign({}, S.input, { width: "100%", paddingLeft: 28 })}
                  className="search-input"
                  placeholder="Search stock name or ticker to add..."
                  value={searchQuery}
                  onChange={function(e) { handleSearch(e.target.value); }}
                />
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#4a6fa5" }}>⌕</span>

                {searching && (
                  <div style={{ color: "#f59e0b", fontSize: 11, padding: "6px 0" }}>
                    ⟳ Searching ASX stocks...
                  </div>
                )}

                {searchError && (
                  <div style={{ color: "#ff4d6d", fontSize: 11, padding: "6px 0" }}>
                    {searchError}
                  </div>
                )}

                {!searching && !searchError && searchQuery.trim() && searchResults.length === 0 && (
                  <div style={{ color: "#4a6fa5", fontSize: 11, padding: "6px 0" }}>
                    No matching stocks found.
                  </div>
                )}

                {fetchingTicker && (
                  <div style={{ color: "#f59e0b", fontSize: 11, padding: "6px 0" }}>
                    ⟳ Fetching real price for {fetchingTicker}...
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div style={{ position: "absolute", top: "110%", left: 0, right: 0, background: "#070f1f", border: "1px solid #00d4ff30", borderRadius: 6, zIndex: 100 }}>
                    {searchResults.map(function(s, idx) {
                      return (
                        <div
                          key={s.ticker}
                          onClick={function() { addStock(s); }}
                          style={{ padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", borderBottom: idx < searchResults.length - 1 ? "1px solid #0f2d4a" : "none" }}
                          onMouseEnter={function(e) { e.currentTarget.style.background = "#00d4ff10"; }}
                          onMouseLeave={function(e) { e.currentTarget.style.background = "transparent"; }}
                        >
                          <div>
                            <span style={{ color: "#00d4ff", fontWeight: 600 }}>{s.ticker.replace(".AX","")}</span>
                            <span style={{ color: "#4a6fa5", marginLeft: 8, fontSize: 11 }}>{s.name}</span>
                          </div>
                          <span style={{ color: "#00ff88", fontSize: 11 }}>+ ADD</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {loading
                ? <div style={{ color: "#4a6fa5", padding: 20, textAlign: "center" }}>⟳ {loadingStatus}</div>
                : stocks.map(function(s) {
                    return (
                      <div key={s.ticker} style={S.row(selectedStock && selectedStock.ticker === s.ticker)} onClick={function() { setSelectedStock(s); }}>
                        <div style={{ minWidth: 80 }}>
                          <div style={{ color: "#e2e8f0", fontWeight: 600 }}>{s.ticker.replace(".AX","")}</div>
                          <div style={{ color: "#4a6fa5", fontSize: 11 }}>{s.name}</div>
                        </div>
                        <div style={{ textAlign: "right", minWidth: 75 }}>
                          {s.error || !s.price
                            ? <div style={{ color: "#f59e0b", fontSize: 11 }}>N/A</div>
                            : (
                              <>
                                <div style={{ color: "#e2e8f0" }}>${s.price.toFixed(2)}</div>
                                <div style={s.change >= 0 ? S.up : S.down}>
                                  {s.change >= 0 ? "▲" : "▼"} {Math.abs(s.change)}%
                                </div>
                              </>
                            )
                          }
                        </div>
                        <span className="hide-sm">
                          <Sparkline data={s.chartData || []} color={priceColor(s)} />
                        </span>
                        <button
                          onClick={function(e) { e.stopPropagation(); removeStock(s.ticker); }}
                          style={{ background: "transparent", border: "none", color: "#4a6fa5", cursor: "pointer", fontSize: 14, padding: "0 4px", flexShrink: 0 }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
              }
            </div>

            {selectedStock && (
              <div style={S.card} className="card-inner">
                <div style={S.cardTitle}>Detail — {selectedStock.ticker}</div>
                {selectedStock.error || !selectedStock.price
                  ? (
                    <div>
                      <div style={{ color: "#f59e0b", marginBottom: 12 }}>Could not load price data.</div>
                      <div style={{ color: "#4a6fa5", fontSize: 11, lineHeight: 1.8 }}>
                        This can happen because:<br/>
                        · The Worker could not fetch Yahoo data<br/>
                        · The ticker is temporarily unavailable<br/>
                        · Market data is delayed or missing<br/><br/>
                        Try clicking ↺ REFRESH in the header.
                      </div>
                    </div>
                  )
                  : (
                    <>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 28, color: "#e2e8f0", fontWeight: 700 }}>${selectedStock.price.toFixed(2)}</div>
                        <div style={Object.assign({}, selectedStock.change >= 0 ? S.up : S.down, { fontSize: 14 })}>
                          {selectedStock.change >= 0 ? "▲" : "▼"} {Math.abs(selectedStock.change)}% today
                        </div>
                        <div style={{ color: "#4a6fa5", fontSize: 10, marginTop: 4 }}>~15 min delayed · Worker / Yahoo</div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <MiniChart data={selectedStock.chartData || []} color={priceColor(selectedStock)} id={selectedStock.ticker} />
                        <div style={{ color: "#4a6fa5", fontSize: 10, marginTop: 4 }}>30-day price history</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[["Sector", selectedStock.sector], ["Volume", selectedStock.volume ? (selectedStock.volume / 1e6).toFixed(1) + "M" : "N/A"], ["Exchange", "ASX"], ["Currency", "AUD"]].map(function(item) {
                          return (
                            <div key={item[0]} style={{ background: "#050d1a", borderRadius: 6, padding: "8px 12px" }}>
                              <div style={{ color: "#4a6fa5", fontSize: 10, marginBottom: 2 }}>{item[0]}</div>
                              <div style={{ color: "#e2e8f0" }}>{item[1]}</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )
                }
              </div>
            )}
          </div>
        )}

        {tab === "charts" && (
          <div className="grid2">
            {loading
              ? <div style={Object.assign({}, S.card, { color: "#4a6fa5" })}>⟳ {loadingStatus}</div>
              : stocks.map(function(s) {
                  return (
                    <div key={s.ticker} style={S.card} className="card-inner">
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                        <div>
                          <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{s.ticker.replace(".AX","")}</span>
                          <span style={{ color: "#4a6fa5", fontSize: 11, marginLeft: 8 }}>{s.name}</span>
                        </div>
                        {s.error || !s.price
                          ? <span style={{ color: "#f59e0b", fontSize: 11 }}>N/A</span>
                          : <div style={s.change >= 0 ? S.up : S.down}>${s.price.toFixed(2)} {s.change >= 0 ? "▲" : "▼"}{Math.abs(s.change)}%</div>
                        }
                      </div>
                      <MiniChart data={s.chartData || []} color={priceColor(s)} id={s.ticker} />
                      <div style={{ color: "#4a6fa5", fontSize: 10, marginTop: 6 }}>30-day history · Worker / Yahoo</div>
                    </div>
                  );
                })
            }
          </div>
        )}

        {tab === "news" && (
          <div style={S.card} className="card-inner">
            <div style={S.cardTitle}>ASX News & Announcements</div>
            {NEWS.map(function(n) {
              return (
                <div key={n.id} style={{ padding: "14px 0", borderBottom: "1px solid #0f2d4a", display: "flex", gap: 14 }}>
                  <div style={{ color: "#4a6fa5", fontSize: 11, minWidth: 40 }}>{n.time}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#e2e8f0", marginBottom: 6, lineHeight: 1.5 }}>{n.title}</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={Object.assign({}, S.badge("neutral"), { background: "#00d4ff10", color: "#00d4ff", border: "1px solid #00d4ff20" })}>{n.tag}</span>
                      <span style={S.badge(n.sentiment)}>{n.sentiment === "up" ? "▲ POSITIVE" : n.sentiment === "down" ? "▼ NEGATIVE" : "● NEUTRAL"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "ships" && (
          <div className="grid2">
            <div style={S.card} className="card-inner">
              <div style={S.cardTitle}>Vessel Intelligence — Australian Ports</div>
              {SHIPS.map(function(ship) {
                return (
                  <div key={ship.id} style={S.shipRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 3 }}><span style={S.dot(ship.status)}></span>{ship.name}</div>
                      <div style={{ color: "#4a6fa5", fontSize: 11 }}>{ship.type} · {ship.cargo}</div>
                      <div style={{ color: "#4a6fa5", fontSize: 11, marginTop: 2 }}>{ship.from} → {ship.to}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={Object.assign({}, S.badge(ship.status === "Underway" ? "up" : "neutral"), { marginBottom: 4 })}>{ship.status}</div>
                      <div style={{ color: "#00d4ff", fontSize: 10 }}>{ship.relevance}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={S.card} className="card-inner">
              <div style={S.cardTitle}>Signal Intelligence</div>
              {[
                { color: "#00d4ff", label: "IRON ORE SIGNAL", text: "3 bulk carriers departing Pilbara ports this week. Positive signal for BHP, RIO, FMG." },
                { color: "#f59e0b", label: "LNG SIGNAL", text: "LNG tanker volume from Karratha up 12% vs last month. Supports WDS revenue outlook." },
                { color: "#94a3b8", label: "COAL SIGNAL", text: "Newcastle bulk carriers anchored — slight delay in exports. Watch coal prices." },
              ].map(function(sig) {
                return (
                  <div key={sig.label} style={{ background: "#050d1a", borderRadius: 6, padding: 12, marginBottom: 10, fontSize: 11, color: "#4a6fa5", lineHeight: 1.7 }}>
                    <div style={{ color: sig.color, marginBottom: 6 }}>● {sig.label}</div>
                    <div>{sig.text}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "alerts" && (
          <div className="grid2">
            <div style={S.card} className="card-inner">
              <div style={S.cardTitle}>Active Alerts</div>
              <div style={{ color: "#4a6fa5", fontSize: 10, marginBottom: 12 }}>Alerts check on each price refresh</div>
              {alerts.length === 0 && <div style={{ color: "#4a6fa5" }}>No alerts set.</div>}
              {alerts.map(function(a) {
                return (
                  <div key={a.id} style={S.alertRow}>
                    <div>
                      <span style={{ color: "#00d4ff" }}>{a.ticker.replace(".AX","")}</span>
                      <span style={{ color: "#4a6fa5", margin: "0 8px" }}>price</span>
                      <span style={a.condition === "above" ? S.up : S.down}>{a.condition.toUpperCase()}</span>
                      <span style={{ color: "#e2e8f0", marginLeft: 8 }}>${a.price.toFixed(2)}</span>
                    </div>
                    <button style={S.btnSm} onClick={function() { removeAlert(a.id); }}>REMOVE</button>
                  </div>
                );
              })}
              <div style={{ marginTop: 20 }}>
                <div style={S.cardTitle}>Add New Alert</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select style={S.select} value={newAlert.ticker} onChange={function(e) {
                    setNewAlert(function(p) { return Object.assign({}, p, { ticker: e.target.value }); });
                  }}>
                    {stocks.map(function(s) {
                      return <option key={s.ticker} value={s.ticker}>{s.ticker.replace(".AX","")}</option>;
                    })}
                  </select>
                  <select style={S.select} value={newAlert.condition} onChange={function(e) {
                    setNewAlert(function(p) { return Object.assign({}, p, { condition: e.target.value }); });
                  }}>
                    <option value="above">ABOVE</option>
                    <option value="below">BELOW</option>
                  </select>
                  <input
                    style={Object.assign({}, S.input, { width: 90 })}
                    type="number"
                    placeholder="Price"
                    value={newAlert.price}
                    onChange={function(e) {
                      setNewAlert(function(p) { return Object.assign({}, p, { price: e.target.value }); });
                    }}
                  />
                  <button style={S.btn} onClick={addAlert}>+ ADD ALERT</button>
                </div>
              </div>
            </div>
            <div style={S.card} className="card-inner">
              <div style={S.cardTitle}>Triggered Alerts History</div>
              {triggeredAlerts.length === 0 && <div style={{ color: "#4a6fa5" }}>No alerts triggered yet.</div>}
              {triggeredAlerts.map(function(a, i) {
                return (
                  <div key={i} style={Object.assign({}, S.alertRow, { borderColor: "#ff4d6d30", background: "#ff4d6d08" })}>
                    <div>
                      <span style={{ color: "#ff4d6d" }}>🔔 {a.ticker.replace(".AX","")}</span>
                      <span style={{ color: "#4a6fa5", margin: "0 6px" }}>{a.condition}</span>
                      <span style={{ color: "#e2e8f0" }}>${a.price.toFixed(2)}</span>
                      <span style={{ color: "#4a6fa5", fontSize: 10, marginLeft: 8 }}>@ {a.triggeredAt}</span>
                    </div>
                    <button style={S.btnSm} onClick={function() { dismissTriggered(i); }}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
