"use client";

import React, {
  useState, useEffect, useRef, useCallback, useReducer,
} from "react";

// ─────────────────────────────── Mock data ────────────────────────────────

const BUILDING = {
  name: "Edificio Costanera Center",
  address: "Av. Andrés Bello 2425, Providencia",
};

const RESIDENTS = [
  { id: "r1", name: "Juan Pérez",      apartment: "302",  tower: "A", floor: 3,  autoApprove: false, status: "active" },
  { id: "r2", name: "María González",  apartment: "1204", tower: "A", floor: 12, autoApprove: true,  status: "active" },
  { id: "r3", name: "Carlos Soto",     apartment: "705",  tower: "B", floor: 7,  autoApprove: false, status: "active" },
  { id: "r4", name: "Valentina Rivas", apartment: "108",  tower: "B", floor: 1,  autoApprove: false, status: "suspended" },
];

const APARTMENTS = [
  { code:"101",tower:"A",floor:1 },{ code:"102",tower:"A",floor:1 },{ code:"103",tower:"A",floor:1 },
  { code:"201",tower:"A",floor:2 },{ code:"202",tower:"A",floor:2 },{ code:"302",tower:"A",floor:3 },
  { code:"401",tower:"A",floor:4 },{ code:"501",tower:"A",floor:5 },{ code:"601",tower:"A",floor:6 },
  { code:"701",tower:"A",floor:7 },{ code:"801",tower:"A",floor:8 },{ code:"901",tower:"A",floor:9 },
  { code:"1001",tower:"A",floor:10 },{ code:"1101",tower:"A",floor:11 },{ code:"1204",tower:"A",floor:12 },
  { code:"108",tower:"B",floor:1 },{ code:"208",tower:"B",floor:2 },{ code:"308",tower:"B",floor:3 },
  { code:"408",tower:"B",floor:4 },{ code:"508",tower:"B",floor:5 },{ code:"608",tower:"B",floor:6 },
  { code:"705",tower:"B",floor:7 },{ code:"808",tower:"B",floor:8 },{ code:"908",tower:"B",floor:9 },
];

const ACCESS_CODES = [
  { code:"1234", type:"resident",  label:"Residente Depto 302",  validUntil:null,         maxUses:null, usesCount:0, status:"active" },
  { code:"5678", type:"resident",  label:"Residente Depto 1204", validUntil:null,         maxUses:null, usesCount:0, status:"active" },
  { code:"9999", type:"temporary", label:"Técnico HVAC",         validUntil:"2027-12-31", maxUses:5,    usesCount:2, status:"active" },
  { code:"7890", type:"master",    label:"Administración",       validUntil:null,         maxUses:null, usesCount:0, status:"active" },
  { code:"0000", type:"revoked",   label:"Código revocado",      validUntil:null,         maxUses:null, usesCount:0, status:"revoked" },
];

const INTERNAL_CONTACTS = [
  { id:"conserjeria", name:"Conserjería",    icon:"C", color:"#2e8bff", ext:"101" },
  { id:"admin",       name:"Administración", icon:"A", color:"#8b5cf6", ext:"102" },
  { id:"mantencion",  name:"Mantención",     icon:"M", color:"#f59e0b", ext:"103" },
  { id:"emergencia",  name:"Emergencia",     icon:"!", color:"#ef4444", ext:"911" },
];

// ─────────────────────────── State machine ────────────────────────────────

const INIT = { screen:"welcome", payload:{}, failedAttempts:0, lockedUntil:null };

function reducer(state, action) {
  switch (action.type) {
    case "GOTO":    return { ...state, screen: action.screen, payload: action.payload ?? {} };
    case "RESET":   return { ...INIT };
    case "ACCESS_FAIL": {
      const fails = state.failedAttempts + 1;
      return { ...state, failedAttempts: fails, lockedUntil: fails >= 3 ? Date.now() + 60000 : state.lockedUntil };
    }
    case "ACCESS_OK":   return { ...state, failedAttempts: 0, lockedUntil: null };
    case "UNLOCK":      return { ...state, failedAttempts: 0, lockedUntil: null };
    default:        return state;
  }
}

// ─────────────────────────── Utils ────────────────────────────────────────

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();

function findResidentByApt(code) {
  return RESIDENTS.find((r) => r.apartment === code && r.status === "active") ?? null;
}

function findResidentByText(text) {
  const t = norm(text);
  const m = t.match(/\b0?(\d{2,4})\b/);
  if (m) { const r = RESIDENTS.find((x) => x.apartment === m[1]); if (r) return r; }
  for (const r of RESIDENTS) {
    if (norm(r.name).split(" ").some((p) => p.length > 2 && t.includes(p))) return r;
  }
  return null;
}

function validateCode(code) {
  const e = ACCESS_CODES.find((c) => c.code === code);
  if (!e)                                         return { valid: false, reason: "invalid" };
  if (e.status === "revoked")                     return { valid: false, reason: "revoked" };
  if (e.status === "exhausted")                   return { valid: false, reason: "exhausted" };
  if (e.validUntil && new Date(e.validUntil) < new Date()) return { valid: false, reason: "expired" };
  if (e.maxUses != null && e.usesCount >= e.maxUses)       return { valid: false, reason: "exhausted" };
  return { valid: true, entry: e };
}

function rnd(min, max) { return Math.floor(min + Math.random() * (max - min)); }

// ─────────────────────────── Speech hook ──────────────────────────────────

function useSpeech() {
  const [supported, setSupported] = useState({ tts:false, stt:false });
  const recRef = useRef(null);

  useEffect(() => {
    const hasTts = "speechSynthesis" in window;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported({ tts: hasTts, stt: !!SR });
    if (SR) {
      const r = new SR(); r.lang="es-CL"; r.continuous=false; r.interimResults=false;
      recRef.current = r;
    }
    if (hasTts) window.speechSynthesis.getVoices();
  }, []);

  const cancelAudio = useCallback(() => window.speechSynthesis?.cancel(), []);

  const speak = useCallback((text, onEnd) => {
    if (!("speechSynthesis" in window)) { onEnd?.(); return; }
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang="es-CL"; u.rate=1.0;
    u.onend = () => onEnd?.();
    u.onerror = (e) => { console.error("[TTS]", e.error); onEnd?.(); };
    const voices = synth.getVoices();
    const es = voices.filter((v) => /^es/i.test(v.lang));
    const best = es.find((v) => v.localService) || es[0];
    if (best) u.voice = best;
    synth.speak(u);
  }, []);

  const listen = useCallback((onResult, onError) => {
    const r = recRef.current;
    if (!r) { onError?.("unsupported"); return; }
    r.onresult = (e) => onResult(e.results[0][0].transcript);
    r.onerror  = (e) => onError?.(e.error);
    try { r.start(); } catch(_) {}
  }, []);

  const stopListen = useCallback(() => { try { recRef.current?.stop(); } catch(_) {} }, []);

  return { supported, speak, cancelAudio, listen, stopListen };
}

// ─────────────────────────── Shared UI ────────────────────────────────────

function StatusOrb({ mode = "idle" }) {
  const c = { idle:"#2e8bff", listening:"#22d3ee", thinking:"#818cf8", speaking:"#2e8bff", alert:"#ef4444" }[mode] ?? "#2e8bff";
  return (
    <div className="sorb" style={{"--sc": c}}>
      <div className="sorb__dot" />
      <div className="sorb__ring" />
    </div>
  );
}

function TopBar({ title, subtitle, onBack, onHome, clock, orbMode = "idle" }) {
  return (
    <div className="topbar">
      <div className="topbar__left">
        {onBack && (
          <button className="topbar__back" onClick={onBack} aria-label="Volver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
        )}
        <div>
          <div className="topbar__title">{title}</div>
          {subtitle && <div className="topbar__sub">{subtitle}</div>}
        </div>
      </div>
      <div className="topbar__right">
        {clock && (
          <span className="topbar__clock">
            {clock.toLocaleTimeString("es-CL",{ hour:"2-digit", minute:"2-digit" })}
          </span>
        )}
        <StatusOrb mode={orbMode} />
        {onHome && (
          <button className="topbar__home" onClick={onHome} aria-label="Inicio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function NumericKeypad({ value, onChange, onSubmit, masked = false, maxLength = 6, label }) {
  const display = masked ? "•".repeat(value.length) : (value || "");
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <div className="keypad">
      {label && <div className="keypad__label">{label}</div>}
      <div className="keypad__display">
        <span className={value.length === 0 ? "keypad__ph" : "keypad__val"}>{value.length === 0 ? "_ _ _ _" : display}</span>
      </div>
      <div className="keypad__grid">
        {keys.map((k, i) =>
          k === "" ? <div key={i} /> :
          k === "⌫" ? (
            <button key={i} className="keypad__key keypad__key--del" onClick={() => onChange(value.slice(0,-1))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
              </svg>
            </button>
          ) : (
            <button key={i} className="keypad__key" onClick={() => value.length < maxLength && onChange(value + k)}>{k}</button>
          )
        )}
      </div>
      <button className={`keypad__confirm${value.length >= 3 ? " keypad__confirm--on" : ""}`} disabled={value.length < 3} onClick={onSubmit}>
        Confirmar
      </button>
    </div>
  );
}

function CountdownTimer({ seconds, onExpire }) {
  const [rem, setRem] = useState(seconds);
  const circ = 2 * Math.PI * 26;
  useEffect(() => {
    if (rem <= 0) { onExpire?.(); return; }
    const t = setTimeout(() => setRem((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [rem, onExpire]);
  return (
    <div className="ctimer">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="3"/>
        <circle cx="32" cy="32" r="26" fill="none"
          stroke={rem <= 5 ? "#ef4444" : "#2e8bff"} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={circ*(1-rem/seconds)}
          strokeLinecap="round"
          style={{ transform:"rotate(-90deg)", transformOrigin:"center", transition:"stroke-dashoffset 1s linear, stroke .3s" }}
        />
      </svg>
      <span className="ctimer__n" style={{ color: rem <= 5 ? "#ef4444" : "#e2e8f0" }}>{rem}</span>
    </div>
  );
}

function CallingScreen({ target, subtitle, onCancel, onTimeout, timeoutSeconds = 30 }) {
  return (
    <div className="calling">
      <div className="calling__rings">
        <div className="calling__ring calling__ring--1"/>
        <div className="calling__ring calling__ring--2"/>
        <div className="calling__ring calling__ring--3"/>
        <div className="calling__ava">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      </div>
      <div className="calling__target">{target}</div>
      {subtitle && <div className="calling__sub">{subtitle}</div>}
      <CountdownTimer seconds={timeoutSeconds} onExpire={onTimeout} />
      <button className="calling__cancel" onClick={onCancel}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        Cancelar
      </button>
    </div>
  );
}

function ResultCard({ status, title, body, actions }) {
  const cfg = {
    success: { color:"#22c55e", icon:<path d="M20 6 9 17 4 12"/> },
    error:   { color:"#ef4444", icon:<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> },
    warning: { color:"#f59e0b", icon:<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
    info:    { color:"#2e8bff", icon:<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></> },
  };
  const { color, icon } = cfg[status] ?? cfg.info;
  return (
    <div className="rcard">
      <div className="rcard__icon" style={{ borderColor: color, color }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="34" height="34">{icon}</svg>
      </div>
      <div className="rcard__title">{title}</div>
      {body && <div className="rcard__body">{body}</div>}
      {actions && <div className="rcard__actions">{actions}</div>}
    </div>
  );
}

// ─────────────────────────── Welcome Screen ───────────────────────────────

const QBTNS = [
  { id:"visit",     label:"Visita",            icon:<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  { id:"delivery",  label:"Delivery",           icon:<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></> },
  { id:"contacts",  label:"Contactos",          icon:<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></> },
  { id:"concierge", label:"Llamar a Conserje",  icon:<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.44 6.44l.96-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/> },
  { id:"access",    label:"Clave de Acceso",    icon:<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
];

function WelcomeScreen({ dispatch, clock }) {
  return (
    <main className="vg-welcome">
      <div className="vg-welcome-glow"/>
      <header className="vg-header">
        <div className="vg-brand">
          <div className="vg-logo">v</div>
          <div>
            <div className="vg-brand-name">vGuardian</div>
            <div className="vg-brand-sub">CONSERJERÍA VIRTUAL</div>
          </div>
        </div>
        <div className="vg-header-right">
          <div className="vg-status"><span className="vg-status-dot"/>En línea</div>
          <span className="vg-clock">{clock.toLocaleTimeString("es-CL",{ hour:"2-digit", minute:"2-digit" })}</span>
        </div>
      </header>

      <div className="wlc-orb-wrap">
        <div className="orb orb--idle">
          <div className="orb__ring orb__ring--3"/>
          <div className="orb__ring orb__ring--2"/>
          <div className="orb__ring orb__ring--1"/>
          <div className="orb__core" style={{ background:"radial-gradient(circle at 32% 28%, rgba(255,255,255,0.92) 0%, #2e8bff 26%, #0a3570 60%, #020818 100%)", boxShadow:"0 0 50px rgba(46,139,255,0.55), 0 0 100px rgba(46,139,255,0.2), inset 0 0 24px rgba(255,255,255,0.1)" }}>
            <div className="orb__scan"/>
            <div className="orb__glint"/>
          </div>
        </div>
      </div>

      <h1 className="vg-welcome-title">Bienvenido</h1>
      <p className="vg-welcome-building">{BUILDING.name}</p>
      <p className="vg-welcome-hint">Conserjería virtual inteligente · disponible 24/7</p>

      <div className="wlc-grid">
        <div className="wlc-row wlc-row--3">
          {QBTNS.slice(0,3).map((b) => (
            <button key={b.id} className="wb" onClick={() => dispatch({ type:"GOTO", screen: b.id })}>
              <span className="wb__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{b.icon}</svg></span>
              <span className="wb__label">{b.label}</span>
            </button>
          ))}
        </div>
        <div className="wlc-row wlc-row--2">
          {QBTNS.slice(3).map((b) => (
            <button key={b.id} className="wb" onClick={() => dispatch({ type:"GOTO", screen: b.id })}>
              <span className="wb__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{b.icon}</svg></span>
              <span className="wb__label">{b.label}</span>
            </button>
          ))}
        </div>
        <button className="wb wb--voice" onClick={() => dispatch({ type:"GOTO", screen:"conversation" })}>
          <span className="wb__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></span>
          <span className="wb__label">Hablar con vGuardian AI</span>
        </button>
      </div>
    </main>
  );
}

// ─────────────────────────── Visit Flow ───────────────────────────────────

// QR codes mock: token → resident
const MOCK_QR = {
  "VG-QR-302-DEMO":  RESIDENTS.find((r) => r.apartment === "302"),
  "VG-QR-1204-DEMO": RESIDENTS.find((r) => r.apartment === "1204"),
};

function QrScannerView({ onDetected, onError }) {
  const [phase, setPhase] = useState("scanning"); // scanning | detected | failed
  const [progress, setProgress] = useState(0);
  const tid = useRef(null);

  useEffect(() => {
    // Simulate scan progress then random success/fail
    const inc = setInterval(() => setProgress((p) => Math.min(p + rnd(8, 18), 100)), 300);
    tid.current = setTimeout(() => {
      clearInterval(inc);
      setProgress(100);
      // 70 % chance of successful scan in demo
      if (Math.random() > 0.3) {
        setPhase("detected");
        setTimeout(() => onDetected(Math.random() > 0.5 ? "VG-QR-302-DEMO" : "VG-QR-1204-DEMO"), 600);
      } else {
        setPhase("failed");
        setTimeout(() => onError("no_qr"), 1000);
      }
    }, 3200);
    return () => { clearInterval(inc); clearTimeout(tid.current); };
  }, [onDetected, onError]);

  return (
    <div className="qr-wrap">
      <div className={`qr-frame qr-frame--${phase}`}>
        {/* Corner brackets */}
        <div className="qr-corner qr-corner--tl"/>
        <div className="qr-corner qr-corner--tr"/>
        <div className="qr-corner qr-corner--bl"/>
        <div className="qr-corner qr-corner--br"/>
        {/* Scan line */}
        {phase === "scanning" && <div className="qr-scanline"/>}
        {/* State icon */}
        {phase === "detected" && (
          <div className="qr-state qr-state--ok">
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        )}
        {phase === "failed" && (
          <div className="qr-state qr-state--err">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="40" height="40"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="qr-progress-wrap">
        <div className="qr-progress-bar" style={{ width: `${progress}%` }}/>
      </div>

      <p className="qr-hint">
        {phase === "scanning" && "Apunte la cámara al código QR de su invitación"}
        {phase === "detected" && "QR detectado ✓"}
        {phase === "failed" && "No se detectó código. Intente de nuevo o use el teclado."}
      </p>
    </div>
  );
}

function VisitScreen({ dispatch, clock }) {
  // sub: choice | qr | input | calling | result
  const [sub, setSub] = useState("choice");
  const [apt, setApt] = useState("");
  const [name, setName] = useState("");
  const [result, setResult] = useState(null);
  const [qrKey, setQrKey] = useState(0); // re-mount QR scanner on retry
  const tid = useRef(null);

  // Resolve result after resident response simulation
  const resolveCall = (targetApt) => {
    const r = findResidentByApt(targetApt);
    if (!r) {
      setResult({ status:"error", title:"Departamento no encontrado", body:`No existe el departamento ${targetApt} o no está activo.\nConsulte con conserjería.` });
    } else if (r.status === "suspended") {
      setResult({ status:"warning", title:"No disponible", body:"El residente no puede recibir visitas en este momento.\nConsulte con conserjería." });
    } else {
      const ok = r.autoApprove || Math.random() > 0.3;
      if (ok) {
        setResult({ status:"success", title:"Acceso autorizado", body:`Departamento ${r.apartment} · Torre ${r.tower} · Piso ${r.floor}\nDiríjase al ascensor principal.\n\nFolio: #V-${rnd(1000,9999)}` });
      } else {
        setResult({ status:"error", title:"Acceso no autorizado", body:"El residente no respondió o rechazó la visita.\nPuede llamar a conserjería para asistencia." });
      }
    }
    setSub("result");
  };

  const startCall = (targetApt) => {
    setSub("calling");
    tid.current = setTimeout(() => resolveCall(targetApt), 3500);
  };

  const handleQrDetected = (token) => {
    const resident = MOCK_QR[token];
    if (!resident) {
      setResult({ status:"error", title:"QR inválido", body:"Este código no corresponde a una invitación activa de este edificio.", qrFallback: true });
      setSub("result");
      return;
    }
    // Valid QR → go straight to calling
    startCall(resident.apartment);
  };

  const handleQrError = () => {
    setResult({ status:"warning", title:"QR no detectado", body:"No fue posible leer el código. Puede intentarlo de nuevo o ingresar el departamento manualmente.", qrFallback: true });
    setSub("result");
  };

  const timeout = () => {
    clearTimeout(tid.current);
    setResult({ status:"warning", title:"Sin respuesta", body:"El residente no contestó dentro del plazo.\nLo derivamos a conserjería." });
    setSub("result");
  };

  useEffect(() => () => clearTimeout(tid.current), []);

  // Back logic per sub-screen
  const handleBack = () => {
    if (sub === "choice") { dispatch({ type:"RESET" }); return; }
    if (sub === "qr" || sub === "input") { setSub("choice"); setApt(""); return; }
    if (sub === "result") {
      // If came from QR fallback, go back to choice
      setSub(result?.qrFallback ? "choice" : "input");
      setApt(""); setResult(null);
    }
  };

  const subtitleMap = {
    choice:  "Seleccione cómo desea ingresar",
    qr:      "Escanee el código QR de su invitación",
    input:   "Ingrese el departamento a visitar",
    calling: "Contactando al residente…",
    result:  "Resultado",
  };

  const orbMap = {
    choice: "idle", qr: "thinking", input: "idle",
    calling: "thinking", result: result?.status === "success" ? "speaking" : "idle",
  };

  return (
    <div className="flow-screen">
      <TopBar
        title="Visita"
        subtitle={subtitleMap[sub]}
        onBack={sub !== "calling" ? handleBack : undefined}
        onHome={() => dispatch({ type:"RESET" })}
        clock={clock}
        orbMode={orbMap[sub] ?? "idle"}
      />

      <div className="flow-body">

        {/* ── Sub-menú: elegir método ── */}
        {sub === "choice" && (
          <div className="visit-choice">
            <p className="visit-choice__prompt">¿Cómo desea registrar su visita?</p>

            <button className="visit-btn" onClick={() => setSub("qr")}>
              <div className="visit-btn__icon visit-btn__icon--qr">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <path d="M14 14h2v2h-2zM18 14h3M14 18h2M18 18h3v3M14 21h2"/>
                </svg>
              </div>
              <div className="visit-btn__text">
                <strong>Tengo un código QR</strong>
                <small>Escanee la invitación digital que recibió</small>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" className="visit-btn__arrow"><path d="M9 18l6-6-6-6"/></svg>
            </button>

            <button className="visit-btn" onClick={() => setSub("input")}>
              <div className="visit-btn__icon visit-btn__icon--call">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.44 6.44l.96-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
              <div className="visit-btn__text">
                <strong>Llamar a un residente</strong>
                <small>Ingrese el número de departamento</small>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" className="visit-btn__arrow"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        )}

        {/* ── QR Scanner ── */}
        {sub === "qr" && (
          <QrScannerView
            key={qrKey}
            onDetected={handleQrDetected}
            onError={handleQrError}
          />
        )}

        {/* ── Keypad (llamar a residente) ── */}
        {sub === "input" && (
          <>
            <div className="flow-field">
              <label className="flow-label">Su nombre (opcional)</label>
              <input className="flow-input" value={name} placeholder="Ej: Pedro Mora" onChange={(e) => setName(e.target.value)}/>
            </div>
            <NumericKeypad
              value={apt} onChange={setApt}
              onSubmit={() => startCall(apt)}
              maxLength={4} label="Número de departamento" masked={false}
            />
          </>
        )}

        {/* ── Calling ── */}
        {sub === "calling" && (
          <CallingScreen
            target={`Departamento ${apt || "…"}`}
            subtitle="Notificando al residente…"
            onCancel={() => { clearTimeout(tid.current); setSub("input"); }}
            onTimeout={timeout}
            timeoutSeconds={30}
          />
        )}

        {/* ── Result ── */}
        {sub === "result" && result && (
          <ResultCard status={result.status} title={result.title} body={result.body}
            actions={
              <div className="rbns">
                {result.qrFallback && (
                  <button className="btn btn--outline" onClick={() => { setResult(null); setSub("qr"); setQrKey((k) => k + 1); }}>
                    Reintentar QR
                  </button>
                )}
                {result.status !== "success" && (
                  <button className="btn btn--outline" onClick={() => dispatch({ type:"GOTO", screen:"concierge" })}>
                    Llamar a Conserje
                  </button>
                )}
                <button className="btn btn--primary" onClick={() => dispatch({ type:"RESET" })}>Finalizar</button>
              </div>
            }
          />
        )}

      </div>
    </div>
  );
}

// ─────────────────────────── Delivery Flow ────────────────────────────────

function DeliveryScreen({ dispatch, clock, speak }) {
  const [apt, setApt] = useState("");
  const [company, setCompany] = useState("");
  const [sub, setSub] = useState("input");
  const [result, setResult] = useState(null);
  const tid = useRef(null);

  const DESTS = [
    { id:"lobby",     label:"Dejar en conserjería",    msg:"Por favor deje el paquete en conserjería." },
    { id:"apartment", label:"Subir al departamento",   msg:"El residente autorizó entrega en su departamento." },
    { id:"locker",    label:"Casillero inteligente",   msg:"Use el casillero N°4. Código temporal: " },
  ];

  const call = () => {
    if (apt.length < 2) return;
    setSub("calling");
    tid.current = setTimeout(() => {
      const folio = `D-${rnd(1000,9999)}`;
      const r = findResidentByApt(apt);
      if (!r) {
        setResult({ status:"info", title:"Entrega registrada en conserjería", body:`El departamento ${apt} no fue localizado.\nFolio: #${folio}\nDeje el paquete en conserjería.` });
      } else {
        const dest = DESTS[rnd(0, DESTS.length)];
        const code = rnd(1000,9999);
        const msg = dest.msg + (dest.id==="locker" ? code : "");
        speak(msg);
        setResult({ status:"success", title: dest.label, body:`${msg}\nFolio: #${folio}` });
      }
      setSub("result");
    }, 2800);
  };

  const timeout = () => { clearTimeout(tid.current); const folio=`D-${rnd(1000,9999)}`; setResult({ status:"info", title:"Sin respuesta — Conserjería", body:`El residente no contestó. Deje el paquete en conserjería.\nFolio: #${folio}` }); setSub("result"); };
  useEffect(() => () => clearTimeout(tid.current), []);

  return (
    <div className="flow-screen">
      <TopBar
        title="Delivery"
        subtitle={sub==="input"?"Ingrese los datos de la entrega":sub==="calling"?"Notificando al residente…":"Resultado"}
        onBack={sub==="result"?()=>{ setSub("input"); setApt(""); setResult(null); }:()=>dispatch({ type:"RESET" })}
        onHome={()=>dispatch({ type:"RESET" })}
        clock={clock}
        orbMode={sub==="calling"?"thinking":sub==="result"?"speaking":"idle"}
      />
      <div className="flow-body">
        {sub==="input" && (
          <>
            <div className="flow-field">
              <label className="flow-label">Empresa de delivery</label>
              <input className="flow-input" value={company} placeholder="Ej: Pedidos Ya, Rappi, Correos…" onChange={(e)=>setCompany(e.target.value)}/>
            </div>
            <NumericKeypad value={apt} onChange={setApt} onSubmit={call} maxLength={4} label="Departamento destinatario" masked={false}/>
          </>
        )}
        {sub==="calling" && (
          <CallingScreen
            target={`Departamento ${apt}`}
            subtitle="Consultando instrucciones de entrega…"
            onCancel={()=>{ clearTimeout(tid.current); setSub("input"); }}
            onTimeout={timeout}
            timeoutSeconds={25}
          />
        )}
        {sub==="result" && result && (
          <ResultCard status={result.status} title={result.title} body={result.body}
            actions={<button className="btn btn--primary" onClick={()=>dispatch({ type:"RESET" })}>Finalizar</button>}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Contacts Screen ──────────────────────────────

function ContactsScreen({ dispatch, clock }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [sub, setSub] = useState("dir");
  const [result, setResult] = useState(null);
  const tid = useRef(null);

  const filtered = APARTMENTS.filter((a) => search === "" || a.code.includes(search) || String(a.floor).includes(search));
  const grouped = filtered.reduce((acc, a) => { const k=`Torre ${a.tower}`; if(!acc[k])acc[k]=[]; acc[k].push(a); return acc; }, {});

  const selectItem = (item) => {
    setSelected(item);
    setSub("calling");
    tid.current = setTimeout(() => {
      const ok = Math.random() > 0.35;
      setResult(item.ext
        ? { status:"success", title:`Conectado con ${item.name}`, body:"Un operador o residente atenderá en breve." }
        : ok
          ? { status:"success", title:"Aviso enviado", body:`Se notificó al departamento ${item.code}. El residente fue informado de su visita.` }
          : { status:"warning", title:"Sin respuesta", body:`El residente del depto ${item.code} no respondió. Puede llamar a conserjería.` }
      );
      setSub("result");
    }, 3000);
  };

  useEffect(() => () => clearTimeout(tid.current), []);

  if (sub==="calling" && selected) return (
    <div className="flow-screen">
      <TopBar title="Contactos" onHome={()=>dispatch({ type:"RESET" })} clock={clock} orbMode="thinking"/>
      <div className="flow-body">
        <CallingScreen
          target={selected.ext ? `${selected.name} · Int. ${selected.ext}` : `Departamento ${selected.code} · Torre ${selected.tower}`}
          subtitle={selected.ext ? "Conectando con servicio interno…" : "Anunciando su visita…"}
          onCancel={()=>{ clearTimeout(tid.current); setSub("dir"); setSelected(null); }}
          onTimeout={()=>setSub("result")}
          timeoutSeconds={selected.ext?20:25}
        />
      </div>
    </div>
  );

  if (sub==="result" && result) return (
    <div className="flow-screen">
      <TopBar title="Contactos" onHome={()=>dispatch({ type:"RESET" })} clock={clock} orbMode="idle"/>
      <div className="flow-body">
        <ResultCard status={result.status} title={result.title} body={result.body}
          actions={
            <div className="rbns">
              <button className="btn btn--outline" onClick={()=>{ setSub("dir"); setSelected(null); setResult(null); }}>Volver al directorio</button>
              <button className="btn btn--primary" onClick={()=>dispatch({ type:"RESET" })}>Inicio</button>
            </div>
          }
        />
      </div>
    </div>
  );

  return (
    <div className="flow-screen">
      <TopBar title="Directorio" subtitle="Seleccione un departamento o servicio" onBack={()=>dispatch({ type:"RESET" })} onHome={()=>dispatch({ type:"RESET" })} clock={clock} orbMode="idle"/>
      <div className="flow-body flow-body--scroll">
        <div className="privacy-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Por seguridad, no entregamos datos personales. Podemos ayudarle a contactar o anunciarse con el residente.
        </div>

        <div className="dir-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input className="dir-search" placeholder="Buscar por número de depto o piso…" value={search} onChange={(e)=>setSearch(e.target.value)}/>
        </div>

        <div className="dir-sec-title">Contactos internos</div>
        <div className="dir-internal">
          {INTERNAL_CONTACTS.map((c) => (
            <button key={c.id} className="dir-ic" style={{"--icc":c.color}} onClick={()=>selectItem(c)}>
              <span className="dir-ic__dot" style={{ background: c.color }}/>
              <span className="dir-ic__name">{c.name}</span>
              <span className="dir-ic__ext">Int. {c.ext}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" style={{ marginLeft:"auto", color:"#475569" }}><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>

        <div className="dir-sec-title" style={{ marginTop:16 }}>Departamentos</div>
        {Object.entries(grouped).map(([tower, apts]) => (
          <div key={tower} className="dir-tower">
            <div className="dir-tower__name">{tower}</div>
            <div className="dir-apts">
              {apts.map((a) => (
                <button key={a.code} className="dir-apt" onClick={()=>selectItem(a)}>
                  <span className="dir-apt__code">{a.code}</span>
                  <span className="dir-apt__floor">Piso {a.floor}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length===0 && <div className="dir-empty">Sin resultados para "{search}"</div>}
      </div>
    </div>
  );
}

// ─────────────────────────── Concierge Flow ───────────────────────────────

function ConciergeScreen({ dispatch, clock, speak }) {
  const [sub, setSub] = useState("reason");
  const [priority, setPriority] = useState(null);
  const tid = useRef(null);

  const call = (type) => {
    setPriority(type);
    setSub("calling");
    speak(type==="emergency" ? "Alertando a seguridad. Mantenga la calma." : "Conectando con conserjería.");
    tid.current = setTimeout(() => setSub("result"), type==="emergency" ? 1800 : 3000);
  };

  useEffect(() => () => clearTimeout(tid.current), []);

  return (
    <div className="flow-screen">
      <TopBar
        title="Llamar a Conserje"
        subtitle={sub==="reason"?"¿Cuál es el motivo?":sub==="calling"?"Conectando…":"Conectado"}
        onBack={sub==="reason"?()=>dispatch({ type:"RESET" }):undefined}
        onHome={()=>dispatch({ type:"RESET" })}
        clock={clock}
        orbMode={sub==="calling"?"thinking":sub==="result"?"speaking":"idle"}
      />
      <div className="flow-body">
        {sub==="reason" && (
          <div className="conc-reason">
            <p className="conc-reason__prompt">Seleccione el tipo de atención:</p>
            <button className="conc-btn conc-btn--normal" onClick={()=>call("normal")}>
              <div className="conc-btn__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="26" height="26"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.44 6.44l.96-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              </div>
              <div className="conc-btn__text">
                <strong>Atención normal</strong>
                <small>Consultas, información, asistencia general</small>
              </div>
            </button>
            <button className="conc-btn conc-btn--emergency" onClick={()=>call("emergency")}>
              <div className="conc-btn__icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="26" height="26"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="conc-btn__text">
                <strong>Emergencia</strong>
                <small>Incendio, robo, accidente, situación de riesgo</small>
              </div>
            </button>
          </div>
        )}
        {sub==="calling" && (
          <CallingScreen
            target={priority==="emergency"?"⚠ SEGURIDAD / EMERGENCIAS":"Conserjería vGuardian"}
            subtitle={priority==="emergency"?"Activando protocolo de emergencia…":"Un operador atenderá en breve…"}
            onCancel={()=>{ clearTimeout(tid.current); setSub("reason"); }}
            onTimeout={()=>setSub("result")}
            timeoutSeconds={priority==="emergency"?10:30}
          />
        )}
        {sub==="result" && (
          <ResultCard
            status={priority==="emergency"?"warning":"success"}
            title={priority==="emergency"?"Protocolo de emergencia activo":"Conserje en línea"}
            body={priority==="emergency"
              ? "Se alertó al personal de seguridad. Incidente registrado. Mantenga la calma y permanezca en el área."
              : "Hola, le habla Daniela del centro de monitoreo vGuardian. ¿En qué le puedo ayudar?"}
            actions={<button className="btn btn--primary" onClick={()=>dispatch({ type:"RESET" })}>Finalizar atención</button>}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Access Code Flow ─────────────────────────────

function AccessScreen({ dispatch, totemState, totemDispatch, clock, speak }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [lockRem, setLockRem] = useState(0);
  const [show, setShow] = useState(false);

  const locked = totemState.lockedUntil && totemState.lockedUntil > Date.now();

  useEffect(() => {
    if (!locked) return;
    const iv = setInterval(() => {
      const r = Math.ceil((totemState.lockedUntil - Date.now()) / 1000);
      setLockRem(r);
      if (r <= 0) { totemDispatch({ type:"UNLOCK" }); clearInterval(iv); }
    }, 500);
    setLockRem(Math.ceil((totemState.lockedUntil - Date.now()) / 1000));
    return () => clearInterval(iv);
  }, [locked, totemState.lockedUntil, totemDispatch]);

  const verify = () => {
    if (locked || code.length < 3) return;
    const { valid, entry } = validateCode(code);
    if (valid) {
      totemDispatch({ type:"ACCESS_OK" });
      speak("Acceso autorizado. Bienvenido.");
      const typeLabel = { master:"Administración", temporary:"Temporal", staff:"Personal", resident:"Residente" }[entry.type] ?? entry.type;
      setResult({ status:"success", title:"Acceso autorizado", body:`${entry.label}\nTipo: ${typeLabel}` });
    } else {
      totemDispatch({ type:"ACCESS_FAIL" });
      const left = 3 - (totemState.failedAttempts + 1);
      setResult({ status:"error", title:"Clave incorrecta", body: left > 0 ? `Intento incorrecto. Quedan ${left} intento${left!==1?"s":""}.` : "Clave no válida." });
    }
    setCode("");
  };

  return (
    <div className="flow-screen">
      <TopBar
        title="Clave de Acceso"
        subtitle={locked?"Teclado bloqueado temporalmente":"Ingrese su PIN para acceder"}
        onBack={()=>dispatch({ type:"RESET" })}
        onHome={()=>dispatch({ type:"RESET" })}
        clock={clock}
        orbMode={locked?"alert":"idle"}
      />
      <div className="flow-body">
        {locked ? (
          <div className="acc-locked">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" width="52" height="52"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div className="acc-locked__title">Teclado bloqueado</div>
            <div className="acc-locked__body">Demasiados intentos incorrectos.<br/>Espere <strong>{lockRem}s</strong> para volver a intentar.<br/>Se notificó a conserjería.</div>
            <button className="btn btn--outline" style={{ marginTop:20 }} onClick={()=>dispatch({ type:"GOTO", screen:"concierge" })}>Llamar a Conserje</button>
          </div>
        ) : result ? (
          <ResultCard status={result.status} title={result.title} body={result.body}
            actions={
              <div className="rbns">
                {result.status!=="success" && <button className="btn btn--outline" onClick={()=>setResult(null)}>Intentar de nuevo</button>}
                <button className="btn btn--primary" onClick={()=>{ setResult(null); dispatch({ type:"RESET" }); }}>
                  {result.status==="success"?"Entrar":"Inicio"}
                </button>
              </div>
            }
          />
        ) : (
          <>
            <div className="acc-dots">
              {[0,1,2].map((i) => (
                <div key={i} className={`acc-dot${i < totemState.failedAttempts ? " acc-dot--used":""}`}/>
              ))}
            </div>
            <button className="acc-show" onClick={()=>setShow(!show)}>{show?"Ocultar":"Mostrar"} código</button>
            <NumericKeypad value={code} onChange={setCode} onSubmit={verify} maxLength={6} masked={!show} label="PIN de acceso (4–6 dígitos)"/>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────── Voice Conversation Screen ────────────────────────

function VoiceConversationScreen({ dispatch, clock, speak, cancelAudio, listen, stopListen, supported }) {
  const [avatar, setAvatar] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [ctx, setCtx] = useState({ stage:null, resident:null });
  const logRef = useRef(null);

  function classifyIntent(text) {
    const t = norm(text);
    if (/(emergencia|incendio|fuego|socorro|robo|asalto|herido|policia|ambulancia)/.test(t)) return "emergency";
    if (/(entrega|delivery|paquete|encomienda|pedido|amazon|mercadolibre|correos|repartidor)/.test(t)) return "delivery";
    if (/(operador|conserje|conserjeria|persona real|humano|hablar con alguien|reclamo|queja)/.test(t)) return "escalate";
    if (/(visita|vengo a|busco a|voy al|voy a ver|reunion|para el|al depto|departamento)/.test(t)) return "visit";
    if (/(horario|piscina|gimnasio|quincho|estacionamiento|amenidad|direccion|donde queda|wifi)/.test(t)) return "info";
    if (/(hola|buenas|buenos dias|buenas tardes|buenas noches|que tal)/.test(t) && t.length < 30) return "greeting";
    return "unknown";
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const h = new Date().getHours();
    const part = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
    const g = `${part}. Bienvenido a ${BUILDING.name}. Soy vGuardian, ¿en qué puedo ayudarle?`;
    setMessages([{ who:"bot", text:g }]);
    setAvatar("speaking");
    speak(g, ()=>setAvatar("idle"));
  }, [speak]);

  const pushBot = useCallback((text, opts={}) => {
    setMessages((m)=>[...m,{ who:"bot", text, ...opts }]);
    setAvatar("speaking");
    speak(text, ()=>setAvatar("idle"));
  }, [speak]);

  const handle = useCallback((raw) => {
    const text = raw.trim(); if (!text) return;
    setMessages((m)=>[...m,{ who:"user", text }]);
    setAvatar("thinking");
    setTimeout(() => {
      if (ctx.stage==="await_resident") {
        const r = findResidentByText(text);
        if (!r) { pushBot("No identifiqué al residente. ¿Número de departamento o nombre?"); return; }
        setCtx({ stage:"notifying", resident:r });
        pushBot(`Contactando departamento ${r.apartment}…`, { tag:"notify" });
        setTimeout(() => {
          const ok = r.autoApprove || Math.random() > 0.25;
          if (ok) { pushBot(`Autorizado. Diríjase al piso ${r.floor}.`, { tag:"approved" }); setCtx({ stage:"done", resident:r }); }
          else { pushBot("El residente no autorizó. ¿Llamo a conserjería?", { tag:"rejected" }); setCtx({ stage:"post_reject", resident:r }); }
        }, 2600);
        return;
      }
      if (ctx.stage==="await_delivery") {
        const r = findResidentByText(text);
        if (!r) { pushBot("¿Para qué departamento es la entrega?"); return; }
        pushBot(`Entrega registrada para depto ${r.apartment}. Folio #D-${rnd(1000,9999)}. Deje el paquete en conserjería.`, { tag:"delivery" });
        setCtx({ stage:"done" });
        return;
      }
      if (ctx.stage==="post_reject") {
        if (/(operador|conserj|si|claro|por favor)/.test(norm(text))) {
          setMessages((m)=>[...m,{ who:"system", text:"Conectando con operador…" }]);
          setTimeout(() => { setMessages((m)=>[...m,{ who:"operator", text:"Hola, le habla Daniela de vGuardian. ¿En qué le ayudo?" }]); setAvatar("idle"); }, 2000);
        } else {
          pushBot("Entendido. He registrado la novedad. Que tenga un buen día.");
          setCtx({ stage:"done" });
        }
        return;
      }
      switch (classifyIntent(text)) {
        case "greeting": pushBot("¡Hola! ¿Viene de visita, trae una entrega o necesita información?"); break;
        case "visit": {
          const r = findResidentByText(text);
          if (r) {
            setCtx({ stage:"notifying", resident:r });
            pushBot(`Contactando depto ${r.apartment}…`, { tag:"notify" });
            setTimeout(() => {
              const ok = r.autoApprove || Math.random() > 0.25;
              if (ok) { pushBot(`Autorizado. Piso ${r.floor}.`, { tag:"approved" }); setCtx({ stage:"done", resident:r }); }
              else { pushBot("Sin autorización. ¿Llamo a conserjería?", { tag:"rejected" }); setCtx({ stage:"post_reject", resident:r }); }
            }, 2600);
          } else { setCtx({ stage:"await_resident" }); pushBot("¿A qué departamento desea visitar?"); }
          break;
        }
        case "delivery": setCtx({ stage:"await_delivery" }); pushBot("¿Para qué departamento es la entrega?", { tag:"delivery" }); break;
        case "info":     pushBot(`${BUILDING.name} · ${BUILDING.address}. ¿Algo más en que pueda ayudarle?`); break;
        case "emergency":
          setAvatar("alert");
          setMessages((m)=>[...m,{ who:"bot", text:"Emergencia detectada. Alertando a seguridad. Mantenga la calma.", tag:"alert" }]);
          speak("Emergencia detectada. Alertando a seguridad.");
          break;
        case "escalate":
          setMessages((m)=>[...m,{ who:"system", text:"Conectando con operador…" }]);
          setTimeout(()=>{ setMessages((m)=>[...m,{ who:"operator", text:"Hola, le habla Daniela de vGuardian. ¿En qué le ayudo?" }]); setAvatar("idle"); }, 2000);
          break;
        default: pushBot("Puede decirme: «vengo al depto 302», «tengo una entrega» o use los botones del menú principal.");
      }
    }, 800);
  }, [ctx, pushBot, speak]);

  const stageLabel = { listening:"ESCUCHANDO…", thinking:"PROCESANDO…", speaking:"VGUARDIAN RESPONDE", alert:"⚠ ALERTA ACTIVA", idle: ctx.stage==="with_operator"?"OPERADOR EN LÍNEA":"LE ESCUCHO" }[avatar];

  return (
    <div className="flow-screen">
      <TopBar title="vGuardian AI" subtitle="Modo conversacional" onBack={()=>{ cancelAudio(); dispatch({ type:"RESET" }); }} onHome={()=>{ cancelAudio(); dispatch({ type:"RESET" }); }} clock={clock} orbMode={avatar}/>
      <div className="flow-body flow-body--chat">
        <div className="conv-stage">
          <div className={`orb orb--${avatar}`}>
            <div className="orb__ring orb__ring--3"/>
            <div className="orb__ring orb__ring--2"/>
            <div className="orb__ring orb__ring--1"/>
            <div className="orb__core" style={{ background:"radial-gradient(circle at 32% 28%, rgba(255,255,255,0.92) 0%, #2e8bff 26%, #0a3570 60%, #020818 100%)", boxShadow:`0 0 50px rgba(46,139,255,0.55), inset 0 0 24px rgba(255,255,255,0.1)` }}>
              <div className="orb__scan"/><div className="orb__glint"/>
            </div>
            <div className="orb__bars">{Array.from({length:14}).map((_,i)=><span key={i} style={{ animationDelay:`${i*.06}s`, background:"#2e8bff" }}/>)}</div>
          </div>
          <div className="conv-label">{stageLabel}</div>
        </div>
        <div className="vg-log" ref={logRef}>
          {messages.map((m,i)=>(
            <div key={i} className={`vg-msg vg-msg--${m.who}${m.tag?` vg-msg--${m.tag}`:""}`}>
              {(m.who==="bot"||m.who==="operator"||m.who==="system")&&<div className="vg-msg-label">{m.who==="bot"?"VGUARDIAN AI":m.who==="operator"?"OPERADOR":"SISTEMA"}</div>}
              <div className="vg-bubble">{m.text}</div>
            </div>
          ))}
        </div>
        <div className="vg-composer">
          <button className={`vg-mic${listening?" vg-mic--active":""}`} onClick={()=>{
            if (!supported.stt) { handle("(micrófono no disponible)"); return; }
            if (listening) { stopListen(); setListening(false); setAvatar("idle"); return; }
            setListening(true); setAvatar("listening");
            listen((txt)=>{ setListening(false); handle(txt); }, ()=>{ setListening(false); setAvatar("idle"); });
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
          </button>
          <input className="vg-input" value={input} placeholder="Escriba su mensaje…" onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>{ if(e.key==="Enter"&&input.trim()){ handle(input); setInput(""); }}}/>
          <button className="vg-send" onClick={()=>{ if(input.trim()){ handle(input); setInput(""); }}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Main component ───────────────────────────────

export default function Totem() {
  const { supported, speak, cancelAudio, listen, stopListen } = useSpeech();
  const [state, dispatch] = useReducer(reducer, INIT);
  const [clock, setClock] = useState(new Date());
  const idleRef = useRef(null);

  useEffect(() => { const t=setInterval(()=>setClock(new Date()),1000); return ()=>clearInterval(t); }, []);

  const resetIdle = useCallback(() => {
    clearTimeout(idleRef.current);
    if (state.screen !== "welcome") {
      idleRef.current = setTimeout(()=>{ cancelAudio(); dispatch({ type:"RESET" }); }, 5*60*1000);
    }
  }, [state.screen, cancelAudio]);

  useEffect(() => { resetIdle(); return ()=>clearTimeout(idleRef.current); }, [state.screen, resetIdle]);

  const shared = { dispatch, clock, speak };

  const screen = (() => {
    switch (state.screen) {
      case "welcome":      return <WelcomeScreen {...shared}/>;
      case "visit":        return <VisitScreen {...shared}/>;
      case "delivery":     return <DeliveryScreen {...shared}/>;
      case "contacts":     return <ContactsScreen {...shared}/>;
      case "concierge":    return <ConciergeScreen {...shared}/>;
      case "access":       return <AccessScreen {...shared} totemState={state} totemDispatch={dispatch}/>;
      case "conversation": return <VoiceConversationScreen {...shared} cancelAudio={cancelAudio} listen={listen} stopListen={stopListen} supported={supported}/>;
      default:             return <WelcomeScreen {...shared}/>;
    }
  })();

  return (
    <div className="vg-root" onPointerDown={resetIdle}>
      <style>{CSS}</style>
      <div className="vg-frame">
        {screen}
        <footer className="vg-footer">
          Este punto registra audio y video para fines de seguridad.
          Tratamiento conforme a la Ley N° 19.628 de Protección de la Vida Privada (Chile).
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────── CSS ──────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.vg-root {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(ellipse 130% 70% at 50% -5%, #0c1e3a 0%, #03060f 55%);
  font-family: 'Manrope', system-ui, sans-serif; color: #F8FAFC; padding: 12px;
}
.vg-frame {
  width: min(100%, 420px); max-height: 96vh; display: flex; flex-direction: column;
  border-radius: 28px; border: 1px solid rgba(255,255,255,.08);
  background: linear-gradient(175deg, #0a1628 0%, #050b1a 100%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.04), 0 0 80px rgba(46,139,255,.1), 0 50px 100px rgba(0,0,0,.7);
  overflow: hidden;
}

/* ── Header (welcome) ── */
.vg-header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid rgba(255,255,255,.06); background:rgba(5,11,26,.92); backdrop-filter:blur(14px); flex-shrink:0; }
.vg-brand  { display:flex; align-items:center; gap:10px; }
.vg-logo   { width:38px; height:38px; border-radius:11px; background:linear-gradient(145deg,#2e8bff,#0a3570); display:flex; align-items:center; justify-content:center; font-size:19px; font-weight:700; color:#fff; font-family:'Sora',sans-serif; box-shadow:0 4px 18px rgba(46,139,255,.45); flex-shrink:0; }
.vg-brand-name { font-size:16px; font-weight:700; font-family:'Sora',sans-serif; letter-spacing:.2px; }
.vg-brand-sub  { font-size:9px; font-weight:500; color:#475569; letter-spacing:2.5px; text-transform:uppercase; margin-top:1px; }
.vg-header-right { display:flex; align-items:center; gap:10px; }
.vg-status { display:flex; align-items:center; gap:5px; padding:4px 9px; border-radius:999px; border:1px solid rgba(34,197,94,.2); background:rgba(34,197,94,.07); font-size:11px; font-weight:500; color:#22C55E; }
.vg-status-dot { width:6px; height:6px; border-radius:50%; background:#22C55E; box-shadow:0 0 8px #22C55E; animation:pulse-dot 2s infinite; }
.vg-clock { font-size:13px; font-weight:600; color:#64748B; font-variant-numeric:tabular-nums; }

/* ── Welcome ── */
.vg-welcome { flex:1; display:flex; flex-direction:column; align-items:center; text-align:center; padding:0 20px 16px; position:relative; overflow:hidden; }
.vg-welcome-glow { position:absolute; inset:0; background:radial-gradient(500px 400px at 50% 42%,rgba(46,139,255,.12),transparent 70%); pointer-events:none; }
.wlc-orb-wrap { margin:20px 0 10px; }
.vg-welcome-title { font-size:40px; font-weight:700; font-family:'Sora',sans-serif; letter-spacing:-1.5px; margin-top:10px; animation:rise .7s .1s both; }
.vg-welcome-building { font-size:14px; color:#94A3B8; margin-top:5px; animation:rise .7s .2s both; }
.vg-welcome-hint { font-size:11.5px; color:#475569; margin-top:5px; letter-spacing:.3px; animation:rise .7s .3s both; }
.wlc-grid { width:100%; display:flex; flex-direction:column; gap:7px; margin-top:20px; animation:rise .7s .4s both; }
.wlc-row { display:grid; gap:7px; }
.wlc-row--3 { grid-template-columns:repeat(3,1fr); }
.wlc-row--2 { grid-template-columns:repeat(2,1fr); }

.wb { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:14px 8px; border-radius:15px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); backdrop-filter:blur(8px); color:#94A3B8; cursor:pointer; font-family:'Manrope',sans-serif; transition:transform .18s,border-color .18s,background .18s,box-shadow .18s,color .18s; min-height:72px; }
.wb:hover { transform:translateY(-2px); border-color:rgba(46,139,255,.5); background:rgba(46,139,255,.1); box-shadow:0 8px 24px rgba(46,139,255,.14); color:#2e8bff; }
.wb:active { transform:scale(0.96); }
.wb__icon { width:20px; height:20px; display:flex; align-items:center; justify-content:center; color:#2e8bff; }
.wb__icon svg { width:100%; height:100%; }
.wb__label { font-size:11px; font-weight:600; color:inherit; text-align:center; line-height:1.2; }
.wb--voice { flex-direction:row; gap:10px; padding:14px 20px; border-color:rgba(46,139,255,.15); border-style:dashed; }
.wb--voice .wb__label { font-size:12px; color:#2e8bff; }

/* ── TopBar ── */
.topbar { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,.06); background:rgba(5,11,26,.9); backdrop-filter:blur(14px); flex-shrink:0; gap:8px; }
.topbar__left { display:flex; align-items:center; gap:10px; min-width:0; }
.topbar__back { width:34px; height:34px; border-radius:10px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); color:#94A3B8; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:.2s; }
.topbar__back:hover { border-color:rgba(46,139,255,.4); color:#2e8bff; }
.topbar__title { font-size:15px; font-weight:700; font-family:'Sora',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.topbar__sub { font-size:10px; color:#475569; font-weight:500; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.topbar__right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.topbar__clock { font-size:12px; font-weight:600; color:#475569; font-variant-numeric:tabular-nums; }
.topbar__home { width:30px; height:30px; border-radius:9px; border:1px solid rgba(255,255,255,.08); background:none; color:#475569; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:.2s; }
.topbar__home:hover { color:#2e8bff; border-color:rgba(46,139,255,.3); }

/* ── StatusOrb ── */
.sorb { position:relative; width:20px; height:20px; display:flex; align-items:center; justify-content:center; }
.sorb__dot { width:8px; height:8px; border-radius:50%; background:var(--sc,#2e8bff); box-shadow:0 0 8px var(--sc,#2e8bff); animation:pulse-dot 2s infinite; }
.sorb__ring { position:absolute; width:18px; height:18px; border-radius:50%; border:1px solid var(--sc,#2e8bff); opacity:.3; animation:pulse-ring 2s infinite; }

/* ── Flow screens ── */
.flow-screen { flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden; }
.flow-body { flex:1; display:flex; flex-direction:column; align-items:center; padding:16px; min-height:0; overflow-y:auto; gap:12px; }
.flow-body--scroll { align-items:stretch; }
.flow-body--chat { padding:10px 14px; gap:8px; }
.flow-field { width:100%; display:flex; flex-direction:column; gap:5px; }
.flow-label { font-size:11px; font-weight:600; color:#475569; letter-spacing:.5px; text-transform:uppercase; }
.flow-input { width:100%; padding:13px 15px; border-radius:12px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); color:#F8FAFC; font-size:14px; font-family:'Manrope',sans-serif; outline:none; transition:.2s; }
.flow-input:focus { border-color:rgba(46,139,255,.48); background:rgba(15,23,42,.85); }
.flow-input::placeholder { color:#334155; }

/* ── NumericKeypad ── */
.keypad { width:100%; display:flex; flex-direction:column; align-items:center; gap:12px; }
.keypad__label { font-size:11px; font-weight:600; color:#475569; letter-spacing:.5px; text-transform:uppercase; align-self:flex-start; }
.keypad__display { width:100%; padding:14px; border-radius:12px; border:1px solid rgba(255,255,255,.1); background:rgba(0,0,0,.3); text-align:center; }
.keypad__val { font-size:28px; font-weight:700; font-family:'Sora',sans-serif; letter-spacing:10px; color:#F8FAFC; }
.keypad__ph { font-size:22px; font-weight:400; letter-spacing:6px; color:#334155; }
.keypad__grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; width:100%; }
.keypad__key { height:64px; border-radius:12px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.05); color:#F8FAFC; font-size:22px; font-weight:600; font-family:'Sora',sans-serif; cursor:pointer; transition:.15s; display:flex; align-items:center; justify-content:center; }
.keypad__key:hover  { background:rgba(46,139,255,.12); border-color:rgba(46,139,255,.4); }
.keypad__key:active { transform:scale(0.94); background:rgba(46,139,255,.2); }
.keypad__key--del { font-size:14px; color:#64748B; }
.keypad__confirm { width:100%; height:56px; border-radius:14px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); color:#475569; font-size:15px; font-weight:600; font-family:'Manrope',sans-serif; cursor:not-allowed; transition:.2s; }
.keypad__confirm--on { background:linear-gradient(145deg,#2e8bff,#1254b5); border-color:transparent; color:#fff; cursor:pointer; box-shadow:0 4px 20px rgba(46,139,255,.3); }
.keypad__confirm--on:hover { box-shadow:0 8px 32px rgba(46,139,255,.45); transform:translateY(-1px); }

/* ── CountdownTimer ── */
.ctimer { position:relative; width:64px; height:64px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.ctimer__n { position:absolute; font-size:18px; font-weight:700; font-family:'Sora',sans-serif; }

/* ── CallingScreen ── */
.calling { display:flex; flex-direction:column; align-items:center; gap:14px; padding:10px 0; }
.calling__rings { position:relative; width:120px; height:120px; display:flex; align-items:center; justify-content:center; }
.calling__ring { position:absolute; border-radius:50%; border:1px solid rgba(46,139,255,.25); animation:call-ring 2s ease-out infinite; }
.calling__ring--1 { width:120px; height:120px; animation-delay:0s; }
.calling__ring--2 { width:90px;  height:90px;  animation-delay:.6s; }
.calling__ring--3 { width:62px;  height:62px;  animation-delay:1.2s; }
.calling__ava { width:56px; height:56px; border-radius:50%; background:rgba(46,139,255,.12); border:1px solid rgba(46,139,255,.3); display:flex; align-items:center; justify-content:center; color:#2e8bff; position:relative; z-index:1; }
.calling__target { font-size:18px; font-weight:700; font-family:'Sora',sans-serif; text-align:center; }
.calling__sub { font-size:12px; color:#64748B; text-align:center; }
.calling__cancel { display:flex; align-items:center; gap:6px; padding:10px 20px; border-radius:10px; border:1px solid rgba(239,68,68,.25); background:rgba(239,68,68,.07); color:#f87171; font-size:13px; font-weight:600; cursor:pointer; font-family:'Manrope',sans-serif; transition:.2s; }
.calling__cancel:hover { background:rgba(239,68,68,.15); border-color:rgba(239,68,68,.4); }

/* ── ResultCard ── */
.rcard { display:flex; flex-direction:column; align-items:center; gap:12px; padding:10px 0; text-align:center; width:100%; animation:rise .4s both; }
.rcard__icon { width:72px; height:72px; border-radius:50%; border:2px solid; display:flex; align-items:center; justify-content:center; }
.rcard__title { font-size:20px; font-weight:700; font-family:'Sora',sans-serif; }
.rcard__body { font-size:13.5px; color:#94A3B8; line-height:1.6; white-space:pre-line; }
.rcard__actions { width:100%; margin-top:4px; }
.rbns { display:flex; flex-direction:column; gap:8px; width:100%; }
.btn { width:100%; height:52px; border-radius:13px; font-size:14px; font-weight:600; font-family:'Manrope',sans-serif; cursor:pointer; transition:.2s; display:flex; align-items:center; justify-content:center; }
.btn--primary { background:linear-gradient(145deg,#2e8bff,#1254b5); border:none; color:#fff; box-shadow:0 4px 20px rgba(46,139,255,.3); }
.btn--primary:hover { box-shadow:0 8px 32px rgba(46,139,255,.45); transform:translateY(-1px); }
.btn--outline { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12); color:#94A3B8; }
.btn--outline:hover { border-color:rgba(46,139,255,.4); color:#2e8bff; background:rgba(46,139,255,.07); }

/* ── Contacts Directory ── */
.privacy-note { display:flex; align-items:flex-start; gap:7px; padding:10px 12px; border-radius:10px; background:rgba(46,139,255,.06); border:1px solid rgba(46,139,255,.15); font-size:11px; color:#64748B; line-height:1.5; margin-bottom:4px; }
.dir-search-wrap { display:flex; align-items:center; gap:8px; padding:10px 13px; border-radius:12px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); }
.dir-search { flex:1; background:none; border:none; color:#F8FAFC; font-size:13px; outline:none; font-family:'Manrope',sans-serif; }
.dir-search::placeholder { color:#334155; }
.dir-sec-title { font-size:10px; font-weight:700; color:#475569; letter-spacing:1.5px; text-transform:uppercase; margin:10px 0 6px; }
.dir-internal { display:flex; flex-direction:column; gap:6px; }
.dir-ic { display:flex; align-items:center; gap:10px; padding:13px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); cursor:pointer; font-family:'Manrope',sans-serif; transition:.2s; }
.dir-ic:hover { border-color:var(--icc,#2e8bff); background:rgba(255,255,255,.06); }
.dir-ic__dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.dir-ic__name { font-size:14px; font-weight:600; color:#E2E8F0; flex:1; text-align:left; }
.dir-ic__ext { font-size:11px; color:#475569; }
.dir-tower { margin-bottom:10px; }
.dir-tower__name { font-size:11px; font-weight:600; color:#2e8bff; letter-spacing:.5px; margin-bottom:6px; }
.dir-apts { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
.dir-apt { padding:10px 6px; border-radius:10px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); cursor:pointer; font-family:'Manrope',sans-serif; transition:.15s; display:flex; flex-direction:column; align-items:center; gap:2px; }
.dir-apt:hover { border-color:rgba(46,139,255,.4); background:rgba(46,139,255,.08); }
.dir-apt__code { font-size:15px; font-weight:700; font-family:'Sora',sans-serif; color:#E2E8F0; }
.dir-apt__floor { font-size:9px; color:#475569; }
.dir-empty { text-align:center; color:#334155; font-size:13px; padding:24px 0; }

/* ── Concierge ── */
.conc-reason { display:flex; flex-direction:column; gap:12px; width:100%; }
.conc-reason__prompt { font-size:14px; color:#94A3B8; text-align:center; }
.conc-btn { display:flex; align-items:center; gap:14px; padding:18px 20px; border-radius:16px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); cursor:pointer; font-family:'Manrope',sans-serif; text-align:left; min-height:80px; transition:.2s; width:100%; }
.conc-btn--normal:hover { border-color:rgba(46,139,255,.5); background:rgba(46,139,255,.08); }
.conc-btn--emergency:hover { border-color:rgba(239,68,68,.5); background:rgba(239,68,68,.07); }
.conc-btn__icon { width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.conc-btn--normal   .conc-btn__icon { background:rgba(46,139,255,.1);  color:#2e8bff; }
.conc-btn--emergency .conc-btn__icon { background:rgba(239,68,68,.1); color:#ef4444; }
.conc-btn__text { display:flex; flex-direction:column; gap:3px; }
.conc-btn__text strong { font-size:15px; font-weight:700; color:#E2E8F0; }
.conc-btn__text small { font-size:11.5px; color:#64748B; }

/* ── Access ── */
.acc-locked { display:flex; flex-direction:column; align-items:center; gap:12px; text-align:center; padding:20px 0; }
.acc-locked__title { font-size:20px; font-weight:700; font-family:'Sora',sans-serif; color:#f87171; }
.acc-locked__body  { font-size:13.5px; color:#94A3B8; line-height:1.6; }
.acc-dots { display:flex; gap:10px; }
.acc-dot { width:12px; height:12px; border-radius:50%; border:1.5px solid rgba(255,255,255,.18); background:transparent; transition:.2s; }
.acc-dot--used { background:#ef4444; border-color:#ef4444; box-shadow:0 0 8px #ef4444; }
.acc-show { background:none; border:none; color:#475569; font-size:11px; font-weight:600; letter-spacing:.5px; text-transform:uppercase; cursor:pointer; font-family:'Manrope',sans-serif; padding:4px 8px; transition:.2s; }
.acc-show:hover { color:#2e8bff; }

/* ── Chat (voice conversation) ── */
.conv-stage { display:flex; flex-direction:column; align-items:center; gap:5px; flex-shrink:0; padding:4px 0; }
.conv-label { font-size:9.5px; font-weight:600; color:#475569; letter-spacing:2px; text-transform:uppercase; }
.vg-log { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:9px; padding-right:2px; min-height:0; scrollbar-width:thin; scrollbar-color:rgba(46,139,255,.18) transparent; }
.vg-log::-webkit-scrollbar { width:3px; }
.vg-log::-webkit-scrollbar-thumb { background:rgba(46,139,255,.18); border-radius:9px; }
.vg-msg { display:flex; flex-direction:column; max-width:90%; animation:rise .4s both; }
.vg-msg--user { align-self:flex-end; align-items:flex-end; }
.vg-msg-label { font-size:9px; font-weight:600; color:#475569; letter-spacing:1.8px; text-transform:uppercase; margin:0 4px 3px; }
.vg-bubble { padding:11px 14px; border-radius:15px; font-size:13.5px; line-height:1.55; border:1px solid rgba(255,255,255,.1); }
.vg-msg--bot      .vg-bubble { background:rgba(15,23,42,.75); backdrop-filter:blur(8px); border-bottom-left-radius:4px; }
.vg-msg--user     .vg-bubble { background:linear-gradient(145deg,#2e8bff,#1254b5); border-color:transparent; color:#fff; border-bottom-right-radius:4px; }
.vg-msg--operator .vg-bubble { background:rgba(34,197,94,.08); border-color:rgba(34,197,94,.28); }
.vg-msg--system   .vg-bubble { background:transparent; border-style:dashed; color:#475569; font-size:12px; }
.vg-msg--alert    .vg-bubble { background:rgba(239,68,68,.1); border-color:rgba(239,68,68,.38); color:#fca5a5; }
.vg-msg--approved .vg-bubble { box-shadow:inset 0 0 0 1px rgba(34,197,94,.22); }
.vg-msg--rejected .vg-bubble { box-shadow:inset 0 0 0 1px rgba(239,68,68,.22); }
.vg-msg--notify   .vg-bubble { box-shadow:inset 0 0 0 1px rgba(46,139,255,.22); }
.vg-composer { display:flex; gap:7px; align-items:center; flex-shrink:0; }
.vg-input { flex:1; padding:12px 15px; border-radius:13px; border:1px solid rgba(255,255,255,.1); background:rgba(15,23,42,.6); backdrop-filter:blur(8px); color:#F8FAFC; font-size:14px; font-family:'Manrope',sans-serif; outline:none; transition:.2s; }
.vg-input:focus { border-color:rgba(46,139,255,.48); }
.vg-input::placeholder { color:#334155; }
.vg-mic, .vg-send { width:46px; height:46px; border-radius:13px; border:1px solid rgba(255,255,255,.1); background:rgba(15,23,42,.6); color:#64748B; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:.18s; }
.vg-mic svg, .vg-send svg { width:19px; height:19px; }
.vg-mic:hover   { border-color:rgba(46,139,255,.4); color:#2e8bff; }
.vg-mic--active { background:rgba(34,211,238,.1); border-color:#22d3ee; color:#22d3ee; animation:pulse-ring 1.3s infinite; }
.vg-send { background:linear-gradient(145deg,#2e8bff,#1254b5); border-color:transparent; color:#fff; }
.vg-send:hover { box-shadow:0 4px 20px rgba(46,139,255,.38); transform:translateY(-1px); }

/* ── Orb ── */
.orb { position:relative; width:110px; height:110px; display:grid; place-items:center; }
.orb__ring { position:absolute; border-radius:50%; border:1px solid rgba(46,139,255,.4); }
.orb__ring--1 { width:88px;  height:88px;  animation:spin 12s linear infinite reverse; opacity:.5; }
.orb__ring--2 { width:100px; height:100px; border-style:dashed; animation:spin 20s linear infinite; opacity:.3; }
.orb__ring--3 { width:110px; height:110px; border-style:dotted; animation:spin 8s linear infinite reverse; opacity:.18; }
.orb__core { width:62px; height:62px; border-radius:50%; position:relative; overflow:hidden; transition:transform .4s,box-shadow .4s; }
.orb__scan { position:absolute; inset:0; background:linear-gradient(180deg,transparent 42%,rgba(255,255,255,.2) 50%,transparent 58%); animation:scan 3s linear infinite; }
.orb__glint { position:absolute; top:14%; left:18%; width:18px; height:9px; border-radius:50%; background:rgba(255,255,255,.52); filter:blur(4px); }
.orb__bars { position:absolute; bottom:-2px; display:flex; align-items:flex-end; gap:2px; height:22px; opacity:0; transition:opacity .3s; }
.orb__bars span { width:2.5px; height:5px; border-radius:2px; }
.orb--speaking .orb__bars, .orb--listening .orb__bars { opacity:.85; }
.orb--speaking .orb__bars span { animation:eq .5s ease-in-out infinite alternate; }
.orb--listening .orb__bars span { animation:eq .35s ease-in-out infinite alternate; }
.orb--speaking .orb__core  { transform:scale(1.07); }
.orb--listening .orb__core { transform:scale(1.04); }
.orb--thinking .orb__ring--2 { animation-duration:1.5s; }
.orb--idle .orb__core  { animation:breathe 4s ease-in-out infinite; }
.orb--alert .orb__core { animation:alert-pulse .6s ease-in-out infinite; }

/* ── Footer ── */
.vg-footer { font-size:9px; color:#1e293b; text-align:center; padding:9px 20px 11px; border-top:1px solid rgba(255,255,255,.05); line-height:1.55; flex-shrink:0; }

/* ── Visit Choice ── */
.visit-choice { display:flex; flex-direction:column; gap:12px; width:100%; }
.visit-choice__prompt { font-size:13px; color:#64748B; text-align:center; margin-bottom:4px; }
.visit-btn { display:flex; align-items:center; gap:14px; padding:18px 18px; border-radius:16px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); cursor:pointer; font-family:'Manrope',sans-serif; text-align:left; min-height:84px; transition:.2s; width:100%; }
.visit-btn:hover { border-color:rgba(46,139,255,.45); background:rgba(46,139,255,.08); transform:translateY(-1px); }
.visit-btn:active { transform:scale(0.98); }
.visit-btn__icon { width:56px; height:56px; border-radius:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.visit-btn__icon--qr   { background:rgba(139,92,246,.12); color:#8b5cf6; border:1px solid rgba(139,92,246,.2); }
.visit-btn__icon--call { background:rgba(46,139,255,.12); color:#2e8bff; border:1px solid rgba(46,139,255,.2); }
.visit-btn__text { display:flex; flex-direction:column; gap:4px; flex:1; }
.visit-btn__text strong { font-size:15px; font-weight:700; color:#E2E8F0; }
.visit-btn__text small { font-size:12px; color:#64748B; }
.visit-btn__arrow { color:#334155; flex-shrink:0; transition:color .2s; }
.visit-btn:hover .visit-btn__arrow { color:#2e8bff; }

/* ── QR Scanner ── */
.qr-wrap { display:flex; flex-direction:column; align-items:center; gap:16px; width:100%; padding:8px 0; }
.qr-frame { position:relative; width:220px; height:220px; background:rgba(0,0,0,.45); border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.qr-corner { position:absolute; width:28px; height:28px; border-color:#2e8bff; border-style:solid; border-width:0; }
.qr-corner--tl { top:8px;    left:8px;    border-top-width:3px;    border-left-width:3px;    border-top-left-radius:4px; }
.qr-corner--tr { top:8px;    right:8px;   border-top-width:3px;    border-right-width:3px;   border-top-right-radius:4px; }
.qr-corner--bl { bottom:8px; left:8px;    border-bottom-width:3px; border-left-width:3px;    border-bottom-left-radius:4px; }
.qr-corner--br { bottom:8px; right:8px;   border-bottom-width:3px; border-right-width:3px;   border-bottom-right-radius:4px; }
.qr-scanline { position:absolute; left:12px; right:12px; height:2px; background:linear-gradient(90deg,transparent,#2e8bff,transparent); box-shadow:0 0 8px rgba(46,139,255,.8); animation:qr-scan 1.8s ease-in-out infinite; }
.qr-frame--detected .qr-corner { border-color:#22c55e; }
.qr-frame--failed   .qr-corner { border-color:#ef4444; }
.qr-state { display:flex; align-items:center; justify-content:center; animation:rise .3s both; }
.qr-progress-wrap { width:220px; height:3px; border-radius:2px; background:rgba(255,255,255,.08); overflow:hidden; }
.qr-progress-bar { height:100%; background:linear-gradient(90deg,#2e8bff,#8b5cf6); border-radius:2px; transition:width .3s ease; }
.qr-hint { font-size:12px; color:#64748B; text-align:center; max-width:240px; line-height:1.5; }

/* ── Animations ── */
@keyframes spin        { to { transform:rotate(360deg); } }
@keyframes scan        { 0% { transform:translateY(-100%); } 100% { transform:translateY(100%); } }
@keyframes eq          { from { height:4px; } to { height:20px; } }
@keyframes breathe     { 0%,100% { transform:scale(1); } 50% { transform:scale(1.05); } }
@keyframes alert-pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.08); } }
@keyframes rise        { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
@keyframes glow-pulse  { 0%,100% { box-shadow:0 0 0 0 rgba(46,139,255,.28); } 50% { box-shadow:0 0 0 12px rgba(46,139,255,0); } }
@keyframes pulse-dot   { 0%,100% { opacity:1; } 50% { opacity:.45; } }
@keyframes pulse-ring  { 0%,100% { box-shadow:0 0 0 0 rgba(34,211,238,.38); } 50% { box-shadow:0 0 0 8px rgba(34,211,238,0); } }
@keyframes call-ring   { 0% { transform:scale(.6); opacity:.7; } 100% { transform:scale(1.4); opacity:0; } }
@keyframes qr-scan     { 0%,100% { top:12px; } 50% { top:calc(100% - 14px); } }
`;
