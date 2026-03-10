import { useState, useEffect, useCallback } from "react";

const STOCKS = [
  { ticker: "BHP.AX", name: "BHP Group", sector: "Materials" },
  { ticker: "CBA.AX", name: "Commonwealth Bank", sector: "Financials" },
  { ticker: "RIO.AX", name: "Rio Tinto", sector: "Materials" },
  { ticker: "WDS.AX", name: "Woodside Energy", sector: "Energy" },
  { ticker: "FMG.AX", name: "Fortescue", sector: "Materials" },
  { ticker: "WBC.AX", name: "Westpac", sector: "Financials" },
  { ticker: "ANZ.AX", name: "ANZ Group", sector: "Financials" },
  { ticker: "NCM.AX", name: "Newcrest Mining", sector: "Materials" },
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
  { id: 1, name: "MV Iron Pilbara", type: "Bulk Carrier", cargo: "Iron Ore", from: "Port Hedland", to: "Qingdao, CN", status: "Underway", lat: -22.4, lng: 118.5, relevance: "BHP / RIO" },
  { id: 2, name: "LNG Endeavour", type: "LNG Tanker", cargo: "LNG", from: "Karratha, WA", to: "Tokyo, JP", status: "Underway", lat: -20.8, lng: 116.2, relevance: "WDS" },
  { id: 3, name: "Pacific Bulker", type: "Bulk Carrier", cargo: "Coal", from: "Newcastle, NSW", to: "Busan, KR", status: "Anchored", lat: -33.1, lng: 152.1, relevance: "Yancoal" },
  { id: 4, name: "Fortescue Star", type: "Bulk Carrier", cargo: "Iron Ore", from: "Port Hedland", to: "Shanghai, CN", status: "Underway", lat: -19.2, lng: 121.4, relevance: "FMG" },
  { id: 5, name: "MV Copper Dawn", type: "General Cargo", cargo: "Copper", from: "Fremantle, WA", to: "Osaka, JP", status: "Underway", lat: -26.3, lng: 112.8, relevance: "RIO" },
];

function generateChartData(basePrice, points = 30) {
  const data = [];
  let price = basePrice;
  for (let i = points; i >= 0; i--) {
    price = price + (Math.random() - 0.48) * (basePrice * 0.015);
    data.push({ day: points - i, price: parseFloat(price.toFixed(2)) });
  }
  return data;
}

function Sparkline({ data, color }) {
  const prices = data.map(d => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 120, h = 40;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.price - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function MiniChart({ data, color }) {
  const prices = data.map(d => d.price);
  const min = Math.min(...prices) * 0.998;
  const max = Math.max(...prices) * 1.002;
  const range = max - min || 1;
  const w = 300, h = 80;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.price - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  const fillPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#grad-${color.replace("#","")})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  const [tab, setTab] = useState("watchlist");
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [alerts, setAlerts] = useState([
    { id: 1, ticker: "BHP.AX", condition: "above", price: 45.00, active: true },
    { id: 2, ticker: "WDS.AX", condition: "below", price: 28.00, active: true },
  ]);
  const [newAlert, setNewAlert] = useState({ ticker: "BHP.AX", condition: "above", price: "" });
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const generateStocks = useCallback(() => {
    const basePrices = { "BHP.AX": 43.2, "CBA.AX": 118.5, "RIO.AX": 118.2, "WDS.AX": 29.4, "FMG.AX": 18.7, "WBC.AX": 28.9, "ANZ.AX": 29.1, "NCM.AX": 24.6 };
    return STOCKS.map(s => {
      const base = basePrices[s.ticker];
      const price = parseFloat((base + (Math.random() - 0.5) * base * 0.02).toFixed(2));
      const change = parseFloat(((price - base) / base * 100).toFixed(2));
      return { ...s, price, change, volume: Math.floor(Math.random() * 5000000 + 500000), chartData: generateChartData(base) };
    });
  }, []);

  useEffect(() => {
    const data = generateStocks();
    setStocks(data);
    setSelectedStock(data[0]);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStocks(prev => prev.map(s => {
        const newPrice = parseFloat((s.price + (Math.random() - 0.5) * s.price * 0.003).toFixed(2));
        const base = { "BHP.AX": 43.2, "CBA.AX": 118.5, "RIO.AX": 118.2, "WDS.AX": 29.4, "FMG.AX": 18.7, "WBC.AX": 28.9, "ANZ.AX": 29.1, "NCM.AX": 24.6 }[s.ticker];
        const newChange = parseFloat(((newPrice - base) / base * 100).toFixed(2));
        const newChartData = [...s.chartData.slice(1), { day: s.chartData.length, price: newPrice }];

        // Check alerts
        alerts.forEach(alert => {
          if (alert.active && alert.ticker === s.ticker) {
            if (alert.condition === "above" && newPrice > alert.price && s.price <= alert.price) {
              setTriggeredAlerts(prev => [...prev, { ...alert, triggeredAt: new Date().toLocaleTimeString(), currentPrice: newPrice }]);
            }
            if (alert.condition === "below" && newPrice < alert.price && s.price >= alert.price) {
              setTriggeredAlerts(prev => [...prev, { ...alert, triggeredAt: new Date().toLocaleTimeString(), currentPrice: newPrice }]);
            }
          }
        });

        return { ...s, price: newPrice, change: newChange, chartData: newChartData };
      }));
      setLastUpdated(new Date());
    }, 4000);
    return () => clearInterval(interval);
  }, [alerts]);

  useEffect(() => {
    if (selectedStock) {
      const updated = stocks.find(s => s.ticker === selectedStock.ticker);
      if (updated) setSelectedStock(updated);
    }
  }, [stocks]);

  const addAlert = () => {
    if (!newAlert.price) return;
    setAlerts(prev => [...prev, { ...newAlert, id: Date.now(), price: parseFloat(newAlert.price), active: true }]);
    setNewAlert({ ticker: "BHP.AX", condition: "above", price: "" });
  };

  const removeAlert = (id) => setAlerts(prev => prev.filter(a => a.id !== id));
  const dismissTriggered = (id) => setTriggeredAlerts(prev => prev.filter(a => a.id !== id));

  const styles = {
    app: { minHeight: "100vh", background: "#050d1a", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', 'Courier New', monospace", fontSize: "13px" },
    header: { background: "#070f1f", borderBottom: "1px solid #0f2d4a", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    logo: { color: "#00d4ff", fontSize: "16px", fontWeight: "700", letterSpacing: "3px", textTransform: "uppercase" },
    pulse: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#00ff88", marginRight: 8, animation: "pulse 2s infinite" },
    nav: { display: "flex", gap: 4, background: "#070f1f", padding: "8px 24px", borderBottom: "1px solid #0f2d4a" },
    navBtn: (active) => ({ background: active ? "#00d4ff15" : "transparent", color: active ? "#00d4ff" : "#4a6fa5", border: active ? "1px solid #00d4ff30" : "1px solid transparent", padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", fontFamily: "inherit" }),
    main: { padding: 24, maxWidth: 1400, margin: "0 auto" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 },
    card: { background: "#070f1f", border: "1px solid #0f2d4a", borderRadius: 8, padding: 16 },
    cardTitle: { color: "#4a6fa5", fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 },
    stockRow: (selected) => ({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 6, cursor: "pointer", background: selected ? "#00d4ff10" : "transparent", border: selected ? "1px solid #00d4ff20" : "1px solid transparent", marginBottom: 4, transition: "all 0.15s" }),
    up: { color: "#00ff88" },
    down: { color: "#ff4d6d" },
    neutral: { color: "#94a3b8" },
    badge: (sentiment) => ({ fontSize: "9px", padding: "2px 6px", borderRadius: 3, background: sentiment === "up" ? "#00ff8815" : sentiment === "down" ? "#ff4d6d15" : "#94a3b815", color: sentiment === "up" ? "#00ff88" : sentiment === "down" ? "#ff4d6d" : "#94a3b8", border: `1px solid ${sentiment === "up" ? "#00ff8830" : sentiment === "down" ? "#ff4d6d30" : "#94a3b830"}` }),
    shipRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0f2d4a" },
    alertRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#0a1628", borderRadius: 6, marginBottom: 6, border: "1px solid #0f2d4a" },
    input: { background: "#050d1a", border: "1px solid #0f2d4a", color: "#e2e8f0", padding: "6px 10px", borderRadius: 4, fontFamily: "inherit", fontSize: "12px" },
    select: { background: "#050d1a", border: "1px solid #0f2d4a", color: "#e2e8f0", padding: "6px 10px", borderRadius: 4, fontFamily: "inherit", fontSize: "12px" },
    btn: { background: "#00d4ff20", color: "#00d4ff", border: "1px solid #00d4ff40", padding: "6px 14px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: "11px", letterSpacing: "1px" },
    btnDanger: { background: "#ff4d6d15", color: "#ff4d6d", border: "1px solid #ff4d6d30", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", fontSize: "10px" },
    triggered: { background: "#ff4d6d10", border: "1px solid #ff4d6d40", borderRadius: 6, padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" },
    statusDot: (status) => ({ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: status === "Underway" ? "#00ff88" : "#f59e0b", marginRight: 6 }),
  };

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #050d1a; } ::-webkit-scrollbar-thumb { background: #0f2d4a; }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>⬡ ASX INTEL</div>
        <div style={{ color: "#4a6fa5", fontSize: "11px" }}>
          <span style={styles.pulse}></span>
          LIVE · {lastUpdated ? lastUpdated.toLocaleTimeString() : "--:--:--"}
        </div>
      </div>

      {/* Ticker bar */}
      <div style={{ background: "#040b17", borderBottom: "1px solid #0f2d4a", padding: "6px 24px", display: "flex", gap: 24, overflowX: "auto" }}>
        {stocks.map(s => (
          <span key={s.ticker} style={{ whiteSpace: "nowrap", fontSize: "11px" }}>
            <span style={{ color: "#4a6fa5" }}>{s.ticker.replace(".AX", "")} </span>
            <span style={{ color: "#e2e8f0" }}>${s.price?.toFixed(2)} </span>
            <span style={s.change >= 0 ? styles.up : styles.down}>{s.change >= 0 ? "▲" : "▼"}{Math.abs(s.change)}%</span>
          </span>
        ))}
      </div>

      {/* Nav */}
      <div style={styles.nav}>
        {[["watchlist","WATCHLIST"],["charts","CHARTS"],["news","NEWS"],["ships","SHIPS"],["alerts","ALERTS"]].map(([id, label]) => (
          <button key={id} style={styles.navBtn(tab === id)} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* Triggered alerts banner */}
      {triggeredAlerts.length > 0 && (
        <div style={{ padding: "8px 24px", background: "#ff4d6d08" }}>
          {triggeredAlerts.map((a, i) => (
            <div key={i} style={styles.triggered}>
              <span>🔔 <strong style={{ color: "#ff4d6d" }}>ALERT</strong> — {a.ticker.replace(".AX","")} {a.condition} ${a.price.toFixed(2)} · Now ${a.currentPrice?.toFixed(2)} · {a.triggeredAt}</span>
              <button style={styles.btnDanger} onClick={() => dismissTriggered(a.id)}>DISMISS</button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.main}>

        {/* WATCHLIST TAB */}
        {tab === "watchlist" && (
          <div style={styles.grid2}>
            <div style={styles.card}>
              <div style={styles.cardTitle}>ASX Watchlist</div>
              {stocks.map(s => (
                <div key={s.ticker} style={styles.stockRow(selectedStock?.ticker === s.ticker)} onClick={() => setSelectedStock(s)}>
                  <div>
                    <div style={{ color: "#e2e8f0", fontWeight: "600" }}>{s.ticker.replace(".AX", "")}</div>
                    <div style={{ color: "#4a6fa5", fontSize: "11px" }}>{s.name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#e2e8f0" }}>${s.price?.toFixed(2)}</div>
                    <div style={s.change >= 0 ? styles.up : styles.down}>{s.change >= 0 ? "▲" : "▼"} {Math.abs(s.change)}%</div>
                  </div>
                  <Sparkline data={s.chartData || []} color={s.change >= 0 ? "#00ff88" : "#ff4d6d"} />
                </div>
              ))}
            </div>
            {selectedStock && (
              <div style={styles.card}>
                <div style={styles.cardTitle}>Detail — {selectedStock.ticker}</div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "28px", color: "#e2e8f0", fontWeight: "700" }}>${selectedStock.price?.toFixed(2)}</div>
                  <div style={{ ...(selectedStock.change >= 0 ? styles.up : styles.down), fontSize: "14px" }}>
                    {selectedStock.change >= 0 ? "▲" : "▼"} {Math.abs(selectedStock.change)}% today
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <MiniChart data={selectedStock.chartData || []} color={selectedStock.change >= 0 ? "#00ff88" : "#ff4d6d"} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[["Sector", selectedStock.sector], ["Volume", (selectedStock.volume / 1e6).toFixed(1) + "M"], ["Exchange", "ASX"], ["Currency", "AUD"]].map(([k, v]) => (
                    <div key={k} style={{ background: "#050d1a", borderRadius: 6, padding: "8px 12px" }}>
                      <div style={{ color: "#4a6fa5", fontSize: "10px", marginBottom: 2 }}>{k}</div>
                      <div style={{ color: "#e2e8f0" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CHARTS TAB */}
        {tab === "charts" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {stocks.map(s => (
                <div key={s.ticker} style={styles.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <span style={{ color: "#e2e8f0", fontWeight: "600" }}>{s.ticker.replace(".AX","")}</span>
                      <span style={{ color: "#4a6fa5", fontSize: "11px", marginLeft: 8 }}>{s.name}</span>
                    </div>
                    <div style={s.change >= 0 ? styles.up : styles.down}>${s.price?.toFixed(2)} {s.change >= 0 ? "▲" : "▼"}{Math.abs(s.change)}%</div>
                  </div>
                  <MiniChart data={s.chartData || []} color={s.change >= 0 ? "#00ff88" : "#ff4d6d"} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NEWS TAB */}
        {tab === "news" && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>ASX News & Announcements</div>
            {NEWS.map(n => (
              <div key={n.id} style={{ padding: "14px 0", borderBottom: "1px solid #0f2d4a", display: "flex", gap: 14, alignItems: "flex-start", animation: "fadeIn 0.3s ease" }}>
                <div style={{ color: "#4a6fa5", fontSize: "11px", minWidth: 40 }}>{n.time}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#e2e8f0", marginBottom: 6, lineHeight: "1.5" }}>{n.title}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ ...styles.badge("neutral"), background: "#00d4ff10", color: "#00d4ff", border: "1px solid #00d4ff20" }}>{n.tag}</span>
                    <span style={styles.badge(n.sentiment)}>{n.sentiment === "up" ? "▲ POSITIVE" : n.sentiment === "down" ? "▼ NEGATIVE" : "● NEUTRAL"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SHIPS TAB */}
        {tab === "ships" && (
          <div style={styles.grid2}>
            <div style={styles.card}>
              <div style={styles.cardTitle}>Vessel Intelligence — Australian Ports</div>
              {SHIPS.map(ship => (
                <div key={ship.id} style={styles.shipRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#e2e8f0", fontWeight: "600", marginBottom: 3 }}>
                      <span style={styles.statusDot(ship.status)}></span>{ship.name}
                    </div>
                    <div style={{ color: "#4a6fa5", fontSize: "11px" }}>{ship.type} · {ship.cargo}</div>
                    <div style={{ color: "#4a6fa5", fontSize: "11px", marginTop: 2 }}>{ship.from} → {ship.to}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...styles.badge(ship.status === "Underway" ? "up" : "neutral"), marginBottom: 4 }}>{ship.status}</div>
                    <div style={{ color: "#00d4ff", fontSize: "10px" }}>{ship.relevance}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={styles.card}>
              <div style={styles.cardTitle}>Signal Intelligence</div>
              <div style={{ color: "#4a6fa5", fontSize: "11px", lineHeight: "1.8" }}>
                <div style={{ background: "#050d1a", borderRadius: 6, padding: 12, marginBottom: 10 }}>
                  <div style={{ color: "#00d4ff", marginBottom: 6 }}>● IRON ORE SIGNAL</div>
                  <div>3 bulk carriers departing Pilbara ports this week. Consistent with elevated demand from Chinese mills. Positive signal for <span style={{ color: "#00ff88" }}>BHP, RIO, FMG</span>.</div>
                </div>
                <div style={{ background: "#050d1a", borderRadius: 6, padding: 12, marginBottom: 10 }}>
                  <div style={{ color: "#f59e0b", marginBottom: 6 }}>● LNG SIGNAL</div>
                  <div>LNG tanker volume from Karratha up 12% vs last month. Supports <span style={{ color: "#00ff88" }}>WDS</span> revenue outlook.</div>
                </div>
                <div style={{ background: "#050d1a", borderRadius: 6, padding: 12 }}>
                  <div style={{ color: "#94a3b8", marginBottom: 6 }}>● COAL SIGNAL</div>
                  <div>Newcastle bulk carriers anchored — slight delay in exports. Watch <span style={{ color: "#f59e0b" }}>coal prices</span> this week.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ALERTS TAB */}
        {tab === "alerts" && (
          <div style={styles.grid2}>
            <div style={styles.card}>
              <div style={styles.cardTitle}>Active Alerts</div>
              {alerts.length === 0 && <div style={{ color: "#4a6fa5" }}>No alerts set.</div>}
              {alerts.map(a => (
                <div key={a.id} style={styles.alertRow}>
                  <div>
                    <span style={{ color: "#00d4ff" }}>{a.ticker.replace(".AX","")}</span>
                    <span style={{ color: "#4a6fa5", margin: "0 8px" }}>price</span>
                    <span style={a.condition === "above" ? styles.up : styles.down}>{a.condition.toUpperCase()}</span>
                    <span style={{ color: "#e2e8f0", marginLeft: 8 }}>${a.price.toFixed(2)}</span>
                  </div>
                  <button style={styles.btnDanger} onClick={() => removeAlert(a.id)}>REMOVE</button>
                </div>
              ))}
              <div style={{ marginTop: 20 }}>
                <div style={styles.cardTitle}>Add New Alert</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select style={styles.select} value={newAlert.ticker} onChange={e => setNewAlert(p => ({ ...p, ticker: e.target.value }))}>
                    {STOCKS.map(s => <option key={s.ticker} value={s.ticker}>{s.ticker.replace(".AX","")}</option>)}
                  </select>
                  <select style={styles.select} value={newAlert.condition} onChange={e => setNewAlert(p => ({ ...p, condition: e.target.value }))}>
                    <option value="above">ABOVE</option>
                    <option value="below">BELOW</option>
                  </select>
                  <input style={{ ...styles.input, width: 90 }} type="number" placeholder="Price" value={newAlert.price} onChange={e => setNewAlert(p => ({ ...p, price: e.target.value }))} />
                  <button style={styles.btn} onClick={addAlert}>+ ADD ALERT</button>
                </div>
              </div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardTitle}>Triggered Alerts History</div>
              {triggeredAlerts.length === 0 && <div style={{ color: "#4a6fa5" }}>No alerts triggered yet. Prices refresh every 4 seconds.</div>}
              {triggeredAlerts.map((a, i) => (
                <div key={i} style={{ ...styles.alertRow, borderColor: "#ff4d6d30", background: "#ff4d6d08" }}>
                  <div>
                    <span style={{ color: "#ff4d6d" }}>🔔 {a.ticker.replace(".AX","")}</span>
                    <span style={{ color: "#4a6fa5", margin: "0 6px" }}>{a.condition}</span>
                    <span style={{ color: "#e2e8f0" }}>${a.price.toFixed(2)}</span>
                    <span style={{ color: "#4a6fa5", fontSize: "10px", marginLeft: 8 }}>@ {a.triggeredAt}</span>
                  </div>
                  <button style={styles.btnDanger} onClick={() => dismissTriggered(a.id)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}