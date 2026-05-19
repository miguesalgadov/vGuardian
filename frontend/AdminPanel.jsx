import React, { useState, useMemo } from "react";

/**
 * eGuardian AI Concierge — PANEL ADMINISTRATIVO (MVP demo prototype)
 * Premium dark operations console. Modules:
 * Dashboard · Residentes · Visitas · Conversaciones · Operadores (teleasistencia)
 * Data is mocked; in production each view consumes the Laravel REST API.
 */

// ------------------------------- Mock data ---------------------------------
const RESIDENTS = [
  { id: 1, name: "Juan Pérez", apt: "302", phone: "+56 9 7654 3210", email: "j.perez@mail.com", auth: "Activo" },
  { id: 2, name: "María González", apt: "1204", phone: "+56 9 8123 4567", email: "m.gonzalez@mail.com", auth: "Activo" },
  { id: 3, name: "Carlos Soto", apt: "705", phone: "+56 9 6011 2233", email: "c.soto@mail.com", auth: "Activo" },
  { id: 4, name: "Valentina Rivas", apt: "108", phone: "+56 9 9988 7766", email: "v.rivas@mail.com", auth: "Suspendido" },
  { id: 5, name: "Diego Fuentes", apt: "1501", phone: "+56 9 4455 6677", email: "d.fuentes@mail.com", auth: "Activo" },
];

const VISITS = [
  { id: "V-2041", visitor: "Andrés Lillo", apt: "302", type: "Visita", status: "Autorizada", time: "09:12", res: "Juan Pérez" },
  { id: "V-2042", visitor: "PedidosYa", apt: "1204", type: "Delivery", status: "Registrada", time: "09:48", res: "María González" },
  { id: "V-2043", visitor: "Sofía Méndez", apt: "705", type: "Visita", status: "Rechazada", time: "10:21", res: "Carlos Soto" },
  { id: "V-2044", visitor: "Correos Chile", apt: "1501", type: "Delivery", status: "Registrada", time: "11:03", res: "Diego Fuentes" },
  { id: "V-2045", visitor: "Téc. Ascensores", apt: "—", type: "Servicio", status: "Escalada", time: "11:40", res: "Administración" },
  { id: "V-2046", visitor: "Camila Ortiz", apt: "108", type: "Visita", status: "Programada", time: "16:30", res: "Valentina Rivas" },
];

const CONVOS = [
  { id: "C-881", channel: "Tótem Lobby", intent: "Visita", dur: "1m 12s", status: "Cerrada IA", res: "Juan Pérez", esc: false },
  { id: "C-882", channel: "Tótem Lobby", intent: "Delivery", dur: "0m 48s", status: "Cerrada IA", res: "María González", esc: false },
  { id: "C-883", channel: "Tótem Lobby", intent: "Emergencia", dur: "3m 05s", status: "Escalada", res: "—", esc: true },
  { id: "C-884", channel: "Tótem Lobby", intent: "Soporte", dur: "2m 41s", status: "Con operador", res: "Carlos Soto", esc: true },
  { id: "C-885", channel: "Tótem Lobby", intent: "Información", dur: "0m 33s", status: "Cerrada IA", res: "—", esc: false },
];

const OPERATORS = [
  { id: 1, name: "Daniela Reyes", status: "Disponible", load: 1, shift: "08:00–16:00" },
  { id: 2, name: "Felipe Cárdenas", status: "En atención", load: 2, shift: "08:00–16:00" },
  { id: 3, name: "Romina Vega", status: "Pausa", load: 0, shift: "08:00–16:00" },
];

const HOURLY = [4, 6, 9, 14, 22, 31, 28, 19, 24, 33, 27, 18, 12];
const DONUT = [
  { k: "Visitas", v: 52, c: "#2e8bff" },
  { k: "Delivery", v: 28, c: "#19e0ff" },
  { k: "Información", v: 14, c: "#7c93ff" },
  { k: "Escaladas", v: 6, c: "#ff5d6c" },
];

// ------------------------------- UI bits -----------------------------------
const Badge = ({ s }) => {
  const map = {
    Autorizada: "ok", Activo: "ok", "Cerrada IA": "ok", Disponible: "ok",
    Rechazada: "bad", Suspendido: "bad",
    Escalada: "warn", "Con operador": "warn", "En atención": "warn",
    Registrada: "info", Programada: "info", Pausa: "mut",
  };
  return <span className={`badge badge--${map[s] || "mut"}`}>{s}</span>;
};

function Donut() {
  const total = DONUT.reduce((a, b) => a + b.v, 0);
  let off = 0;
  const R = 54, C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 140 140" className="donut">
      <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="16" />
      {DONUT.map((d) => {
        const len = (d.v / total) * C;
        const el = (
          <circle key={d.k} cx="70" cy="70" r={R} fill="none" stroke={d.c} strokeWidth="16"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off}
            transform="rotate(-90 70 70)" strokeLinecap="round" />
        );
        off += len;
        return el;
      })}
      <text x="70" y="66" textAnchor="middle" className="donut__big">{total}</text>
      <text x="70" y="84" textAnchor="middle" className="donut__sm">interacciones</text>
    </svg>
  );
}

function Bars() {
  const max = Math.max(...HOURLY);
  return (
    <div className="bars">
      {HOURLY.map((v, i) => (
        <div key={i} className="bars__col" title={`${v} visitas`}>
          <div className="bars__fill" style={{ height: `${(v / max) * 100}%` }} />
          <span>{8 + i}h</span>
        </div>
      ))}
    </div>
  );
}

// ------------------------------- App ---------------------------------------
const NAV = [
  { k: "dash", label: "Dashboard", icon: "M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z" },
  { k: "res", label: "Residentes", icon: "M16 11a4 4 0 1 0-8 0M4 21v-1a6 6 0 0 1 12 0v1" },
  { k: "vis", label: "Visitas", icon: "M3 7h18M3 12h18M3 17h18" },
  { k: "conv", label: "Conversaciones", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { k: "ops", label: "Operadores", icon: "M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5M4 22a8 8 0 0 1 16 0" },
];

export default function AdminPanel() {
  const [tab, setTab] = useState("dash");
  const [q, setQ] = useState("");
  const [active, setActive] = useState(null); // active conversation taken by operator

  const filteredRes = useMemo(
    () => RESIDENTS.filter((r) => (r.name + r.apt + r.email).toLowerCase().includes(q.toLowerCase())),
    [q]
  );

  return (
    <div className="adm">
      <style>{CSS}</style>

      <aside className="side">
        <div className="logo">
          <span className="logo__m">e</span>
          <div>
            <div className="logo__n">eGuardian</div>
            <div className="logo__s">CONSOLE</div>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.k} className={`nav ${tab === n.k ? "nav--on" : ""}`} onClick={() => setTab(n.k)}>
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={n.icon} />
              </svg>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="side__foot">
          <div className="dev"><i /> Tótem Lobby · operativo</div>
          <div className="bld">Edificio Costanera Center</div>
        </div>
      </aside>

      <main className="main">
        <header className="top">
          <div>
            <h1>{NAV.find((n) => n.k === tab).label}</h1>
            <p>Centro de monitoreo remoto · {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <div className="top__r">
            <div className="search">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4-4" /></svg>
              <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="me">DR</div>
          </div>
        </header>

        {/* -------- DASHBOARD -------- */}
        {tab === "dash" && (
          <div className="grid">
            {[
              { k: "Visitas hoy", v: "47", d: "+12% vs ayer", up: true },
              { k: "Conversaciones IA", v: "138", d: "94% resueltas sin operador", up: true },
              { k: "Escalamientos", v: "6", d: "2 activos ahora", up: false },
              { k: "Tiempo medio atención", v: "1m 04s", d: "−18s vs ayer", up: true },
            ].map((c) => (
              <div key={c.k} className="card kpi">
                <span className="kpi__k">{c.k}</span>
                <span className="kpi__v">{c.v}</span>
                <span className={`kpi__d ${c.up ? "up" : "dn"}`}>{c.d}</span>
              </div>
            ))}

            <div className="card span2">
              <div className="card__h"><h3>Flujo de visitas por hora</h3><span>Hoy</span></div>
              <Bars />
            </div>
            <div className="card span2">
              <div className="card__h"><h3>Distribución de intenciones</h3><span>Últimas 24h</span></div>
              <div className="donutwrap">
                <Donut />
                <ul className="legend">
                  {DONUT.map((d) => (
                    <li key={d.k}><i style={{ background: d.c }} />{d.k}<b>{d.v}</b></li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="card span4">
              <div className="card__h"><h3>Alertas y eventos en vivo</h3><span className="live"><i />en vivo</span></div>
              <ul className="feed">
                <li><Badge s="Escalada" /> Emergencia declarada en Tótem Lobby — derivada a Daniela Reyes <em>· hace 2 min</em></li>
                <li><Badge s="Autorizada" /> Juan Pérez (302) autorizó ingreso de Andrés Lillo <em>· hace 8 min</em></li>
                <li><Badge s="Registrada" /> Delivery PedidosYa registrado para depto 1204 <em>· hace 14 min</em></li>
                <li><Badge s="Rechazada" /> Carlos Soto (705) rechazó visita de Sofía Méndez <em>· hace 22 min</em></li>
              </ul>
            </div>
          </div>
        )}

        {/* -------- RESIDENTES -------- */}
        {tab === "res" && (
          <div className="card">
            <div className="card__h">
              <h3>{filteredRes.length} residentes</h3>
              <button className="btn">+ Nuevo residente</button>
            </div>
            <table className="tbl">
              <thead><tr><th>Nombre</th><th>Depto</th><th>Teléfono</th><th>Email</th><th>Autorización</th><th></th></tr></thead>
              <tbody>
                {filteredRes.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.name}</b></td><td>{r.apt}</td><td>{r.phone}</td><td className="mut">{r.email}</td>
                    <td><Badge s={r.auth} /></td>
                    <td><button className="lnk">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* -------- VISITAS -------- */}
        {tab === "vis" && (
          <div className="card">
            <div className="card__h"><h3>Registro de visitas — hoy</h3><span>{VISITS.length} eventos</span></div>
            <table className="tbl">
              <thead><tr><th>ID</th><th>Visitante</th><th>Tipo</th><th>Residente</th><th>Depto</th><th>Hora</th><th>Estado</th></tr></thead>
              <tbody>
                {VISITS.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">{v.id}</td><td><b>{v.visitor}</b></td><td>{v.type}</td>
                    <td>{v.res}</td><td>{v.apt}</td><td className="mono">{v.time}</td><td><Badge s={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* -------- CONVERSACIONES -------- */}
        {tab === "conv" && (
          <div className="grid">
            <div className="card span3">
              <div className="card__h"><h3>Conversaciones recientes</h3><span>{CONVOS.length}</span></div>
              <table className="tbl">
                <thead><tr><th>ID</th><th>Canal</th><th>Intención</th><th>Duración</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {CONVOS.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{c.id}</td><td>{c.channel}</td><td>{c.intent}</td>
                      <td className="mono">{c.dur}</td><td><Badge s={c.status} /></td>
                      <td><button className="lnk">Ver transcripción</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card span1">
              <div className="card__h"><h3>Transcripción C-884</h3></div>
              <div className="transcript">
                <div className="t t--bot"><span>IA</span>Buenas tardes, ¿en qué puedo ayudarle?</div>
                <div className="t t--usr"><span>Visitante</span>No anda el citófono de mi depto hace 2 días</div>
                <div className="t t--bot"><span>IA</span>Lamento el inconveniente. Lo derivaré con un operador.</div>
                <div className="t t--sys">Escalada a Felipe Cárdenas · 11:42</div>
                <div className="t t--op"><span>Operador</span>Hola, soy Felipe. Generé la OT #5521 para mantención.</div>
              </div>
            </div>
          </div>
        )}

        {/* -------- OPERADORES -------- */}
        {tab === "ops" && (
          <div className="grid">
            <div className="card span2">
              <div className="card__h"><h3>Equipo de teleasistencia</h3><span className="live"><i />turno activo</span></div>
              <div className="ops">
                {OPERATORS.map((o) => (
                  <div key={o.id} className="op">
                    <div className="op__av">{o.name.split(" ").map((x) => x[0]).join("")}</div>
                    <div className="op__i">
                      <b>{o.name}</b>
                      <span>{o.shift} · {o.load} en curso</span>
                    </div>
                    <Badge s={o.status} />
                  </div>
                ))}
              </div>
            </div>

            <div className="card span2">
              <div className="card__h"><h3>Cola de escalamiento</h3><span className="badge badge--warn">2 pendientes</span></div>
              <div className="queue">
                <div className="qitem">
                  <div><b>C-883 · Emergencia</b><span>Tótem Lobby · prioridad alta · esperando 00:42</span></div>
                  <button className="btn" onClick={() => setActive("C-883")}>Tomar</button>
                </div>
                <div className="qitem">
                  <div><b>C-884 · Soporte citófono</b><span>Tótem Lobby · normal · esperando 02:10</span></div>
                  <button className="btn btn--ghost" onClick={() => setActive("C-884")}>Tomar</button>
                </div>
              </div>

              {active && (
                <div className="livechat">
                  <div className="livechat__h">
                    <span className="live"><i />Atención en vivo · {active}</span>
                    <button className="lnk" onClick={() => setActive(null)}>Cerrar incidente</button>
                  </div>
                  <div className="t t--usr"><span>Visitante</span>Hola, necesito ayuda urgente</div>
                  <div className="t t--op"><span>Tú</span>Estoy con usted, ya tomé el caso. Cuénteme qué ocurre.</div>
                  <div className="livechat__c">
                    <input placeholder="Escriba como operador…" />
                    <button className="btn">Enviar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600&display=swap');
.adm{--bg:#03060f;--card:rgba(255,255,255,.038);--stroke:rgba(255,255,255,.09);--accent:#2e8bff;--text:#e9f0ff;--mut:#7d8db5;
  display:flex;min-height:100vh;background:radial-gradient(1100px 800px at 80% -10%,#0a1b3d 0%,var(--bg) 55%);
  font-family:'Manrope',system-ui,sans-serif;color:var(--text)}
*{box-sizing:border-box}
.side{width:240px;flex-shrink:0;border-right:1px solid var(--stroke);padding:24px 16px;display:flex;flex-direction:column;backdrop-filter:blur(8px)}
.logo{display:flex;align-items:center;gap:11px;padding:0 8px 26px}
.logo__m{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-family:'Sora';font-weight:700;font-size:20px;color:#fff;background:linear-gradient(145deg,var(--accent),#0c3a8a)}
.logo__n{font-family:'Sora';font-weight:600;font-size:16px}
.logo__s{font-size:10px;color:var(--mut);letter-spacing:3px}
.side nav{display:flex;flex-direction:column;gap:4px;flex:1}
.nav{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;border:none;background:none;color:var(--mut);font-size:14px;font-family:'Manrope';font-weight:500;cursor:pointer;transition:.18s;text-align:left}
.nav:hover{color:var(--text);background:rgba(255,255,255,.04)}
.nav--on{color:#fff;background:linear-gradient(145deg,rgba(46,139,255,.22),rgba(46,139,255,.06));box-shadow:inset 0 0 0 1px rgba(46,139,255,.35)}
.side__foot{font-size:11.5px;color:var(--mut);padding:14px 10px 0;border-top:1px solid var(--stroke)}
.dev{display:flex;align-items:center;gap:8px}.dev i{width:7px;height:7px;border-radius:50%;background:#27e08a;box-shadow:0 0 8px #27e08a}
.bld{margin-top:6px;color:#9fb0d8}
.main{flex:1;padding:26px 32px;min-width:0}
.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}
.top h1{font-family:'Sora';font-weight:700;font-size:25px;margin:0}
.top p{color:var(--mut);font-size:13px;margin:5px 0 0;text-transform:capitalize}
.top__r{display:flex;align-items:center;gap:14px}
.search{display:flex;align-items:center;gap:9px;padding:10px 14px;border-radius:11px;border:1px solid var(--stroke);background:var(--card);color:var(--mut)}
.search input{background:none;border:none;outline:none;color:var(--text);font-size:13px;font-family:'Manrope';width:150px}
.me{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-family:'Sora';font-weight:600;font-size:13px;background:linear-gradient(145deg,var(--accent),#1456b8);color:#fff}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.card{background:var(--card);border:1px solid var(--stroke);border-radius:18px;padding:20px;backdrop-filter:blur(8px)}
.span2{grid-column:span 2}.span3{grid-column:span 3}.span4{grid-column:span 4}.span1{grid-column:span 1}
.card__h{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.card__h h3{font-family:'Sora';font-weight:600;font-size:15px;margin:0}
.card__h span{font-size:12px;color:var(--mut)}
.kpi{display:flex;flex-direction:column;gap:6px}
.kpi__k{font-size:12.5px;color:var(--mut)}
.kpi__v{font-family:'Sora';font-weight:700;font-size:30px;letter-spacing:-.5px}
.kpi__d{font-size:11.5px}.kpi__d.up{color:#3fe09a}.kpi__d.dn{color:#ff8a93}
.bars{display:flex;align-items:flex-end;gap:10px;height:160px;padding-top:8px}
.bars__col{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;justify-content:flex-end}
.bars__fill{width:100%;border-radius:6px 6px 0 0;background:linear-gradient(180deg,#2e8bff,#19e0ff);min-height:6px;transition:.4s}
.bars__col span{font-size:10px;color:var(--mut)}
.donutwrap{display:flex;align-items:center;gap:22px}
.donut{width:150px;height:150px}
.donut__big{font-family:'Sora';font-weight:700;font-size:24px;fill:#fff}
.donut__sm{font-size:8px;fill:var(--mut)}
.legend{list-style:none;margin:0;padding:0;flex:1}
.legend li{display:flex;align-items:center;gap:9px;font-size:13px;padding:6px 0;color:#cdd9f3}
.legend i{width:9px;height:9px;border-radius:3px}.legend b{margin-left:auto;font-family:'Sora'}
.feed{list-style:none;margin:0;padding:0}
.feed li{display:flex;align-items:center;gap:11px;padding:12px 0;border-bottom:1px solid var(--stroke);font-size:13.5px;color:#cdd9f3}
.feed li:last-child{border:none}.feed em{color:var(--mut);font-style:normal;margin-left:auto;font-size:12px}
.live{display:flex;align-items:center;gap:7px;color:#3fe09a!important}.live i{width:7px;height:7px;border-radius:50%;background:#3fe09a;animation:bl 1.4s infinite}
@keyframes bl{50%{opacity:.3}}
.tbl{width:100%;border-collapse:collapse;font-size:13.5px}
.tbl th{text-align:left;color:var(--mut);font-weight:500;font-size:11px;letter-spacing:1px;text-transform:uppercase;padding:10px 12px;border-bottom:1px solid var(--stroke)}
.tbl td{padding:14px 12px;border-bottom:1px solid rgba(255,255,255,.05)}
.tbl tr:hover td{background:rgba(255,255,255,.025)}
.tbl .mut{color:var(--mut)}.mono{font-family:'Sora';font-variant-numeric:tabular-nums;color:#9fb0d8}
.badge{display:inline-block;padding:5px 11px;border-radius:999px;font-size:11.5px;font-weight:600;border:1px solid}
.badge--ok{color:#3fe09a;background:rgba(63,224,154,.1);border-color:rgba(63,224,154,.3)}
.badge--bad{color:#ff8a93;background:rgba(255,93,108,.1);border-color:rgba(255,93,108,.3)}
.badge--warn{color:#ffc861;background:rgba(255,200,97,.1);border-color:rgba(255,200,97,.3)}
.badge--info{color:#7cc4ff;background:rgba(124,196,255,.1);border-color:rgba(124,196,255,.3)}
.badge--mut{color:var(--mut);background:rgba(255,255,255,.05);border-color:var(--stroke)}
.btn{padding:9px 16px;border-radius:10px;border:1px solid transparent;background:linear-gradient(145deg,var(--accent),#1456b8);color:#fff;font-size:12.5px;font-weight:600;font-family:'Manrope';cursor:pointer;transition:.2s}
.btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px -10px var(--accent)}
.btn--ghost{background:none;border-color:var(--stroke);color:#cdd9f3}
.lnk{background:none;border:none;color:var(--accent);font-size:12.5px;cursor:pointer;font-family:'Manrope';font-weight:600}
.transcript,.queue,.ops{display:flex;flex-direction:column;gap:10px}
.t{padding:11px 14px;border-radius:13px;font-size:13px;line-height:1.5;border:1px solid var(--stroke);max-width:92%}
.t span{display:block;font-size:10px;color:var(--mut);letter-spacing:1px;text-transform:uppercase;margin-bottom:4px}
.t--bot{background:rgba(255,255,255,.04)}
.t--usr{background:linear-gradient(145deg,rgba(46,139,255,.18),rgba(46,139,255,.05));align-self:flex-end;border-color:transparent}
.t--op{background:rgba(63,224,154,.1);border-color:rgba(63,224,154,.3)}
.t--sys{background:none;border-style:dashed;color:var(--mut);font-size:11.5px;text-align:center}
.op{display:flex;align-items:center;gap:14px;padding:13px;border-radius:13px;border:1px solid var(--stroke);background:rgba(255,255,255,.02)}
.op__av{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-family:'Sora';font-weight:600;font-size:13px;background:linear-gradient(145deg,#1f3b6e,#0c3a8a);color:#cfe0ff}
.op__i{flex:1}.op__i b{font-size:14px}.op__i span{display:block;font-size:12px;color:var(--mut);margin-top:3px}
.qitem{display:flex;justify-content:space-between;align-items:center;padding:14px;border-radius:13px;border:1px solid var(--stroke)}
.qitem b{font-size:13.5px}.qitem span{display:block;font-size:12px;color:var(--mut);margin-top:4px}
.livechat{margin-top:16px;padding:16px;border-radius:14px;border:1px solid rgba(63,224,154,.3);background:rgba(63,224,154,.04);display:flex;flex-direction:column;gap:10px}
.livechat__h{display:flex;justify-content:space-between;align-items:center}
.livechat__c{display:flex;gap:9px;margin-top:6px}
.livechat__c input{flex:1;padding:11px 14px;border-radius:10px;border:1px solid var(--stroke);background:rgba(255,255,255,.04);color:var(--text);font-size:13px;outline:none;font-family:'Manrope'}
@media(max-width:1100px){.grid{grid-template-columns:repeat(2,1fr)}.span4,.span3,.span2{grid-column:span 2}.span1{grid-column:span 2}.side{width:74px}.logo__n,.logo__s,.nav span,.side__foot{display:none}.nav{justify-content:center}}
`;
