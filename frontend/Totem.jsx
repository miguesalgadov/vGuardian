"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────── Mock data ────────────────────────────────
const RESIDENTS = [
  { id: 1, name: "Juan Pérez",       apartment: "302",  phone: "+56 9 7654 3210", autoApprove: false },
  { id: 2, name: "María González",   apartment: "1204", phone: "+56 9 8123 4567", autoApprove: true  },
  { id: 3, name: "Carlos Soto",      apartment: "705",  phone: "+56 9 6011 2233", autoApprove: false },
  { id: 4, name: "Valentina Rivas",  apartment: "108",  phone: "+56 9 9988 7766", autoApprove: false },
];

const BUILDING = {
  name: "Edificio Costanera Center",
  address: "Av. Andrés Bello 2425, Providencia",
  amenities: "piscina (8:00–22:00), gimnasio (6:00–23:00), quincho (reserva en conserjería)",
  parkingVisitas: "subterráneo -2, sectores V1–V8",
};

// ──────────────────────────── Intent engine ───────────────────────────────
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function findResident(text) {
  const t = norm(text);
  const aptMatch = t.match(/\b(depto|departamento|dpto|unidad|n°|nro|numero)?\s*0?(\d{2,4})\b/);
  if (aptMatch) {
    const r = RESIDENTS.find((x) => x.apartment === aptMatch[2]);
    if (r) return r;
  }
  for (const r of RESIDENTS) {
    const parts = norm(r.name).split(" ");
    if (parts.some((p) => p.length > 2 && t.includes(p))) return r;
  }
  return null;
}

function classifyIntent(text) {
  const t = norm(text);
  if (/(ayuda|emergencia|incendio|fuego|socorro|robo|asalto|herido|policia|ambulancia)/.test(t)) return "emergency";
  if (/(entrega|delivery|paquete|encomienda|pedido|amazon|mercadolibre|correos|repartidor)/.test(t)) return "delivery";
  if (/(operador|conserje|conserjeria|persona real|humano|hablar con alguien|reclamo|queja)/.test(t)) return "escalate";
  if (/(visita|vengo a|busco a|voy al|voy a ver|reunion|para el|al depto|departamento)/.test(t)) return "visit";
  if (/(horario|piscina|gimnasio|quincho|estacionamiento|amenidad|direccion|donde queda|wifi)/.test(t)) return "info";
  if (/(hola|buenas|buenos dias|buenas tardes|buenas noches|que tal)/.test(t) && t.length < 30) return "greeting";
  return "unknown";
}

// ──────────────────────────────── Speech ──────────────────────────────────
function useSpeech() {
  const [supported, setSupported] = useState({ tts: false, stt: false });
  const recRef = useRef(null);

  useEffect(() => {
    const hasTts = "speechSynthesis" in window;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported({ tts: hasTts, stt: !!SR });
    if (SR) {
      const r = new SR();
      r.lang = "es-CL";
      r.continuous = false;
      r.interimResults = false;
      recRef.current = r;
    }
    if (hasTts) window.speechSynthesis.getVoices();
  }, []);

  const cancelAudio = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  const speak = useCallback((text, onEnd) => {
    if (!("speechSynthesis" in window)) { onEnd?.(); return; }
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-CL";
    u.rate = 1.0;
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
    try { r.start(); } catch (_) {}
  }, []);

  const stopListen = useCallback(() => {
    try { recRef.current?.stop(); } catch (_) {}
  }, []);

  return { supported, speak, cancelAudio, listen, stopListen };
}

// ──────────────────────────── AssistantOrb ────────────────────────────────
function AssistantOrb({ mode }) {
  const theme = {
    idle:      { glow: "rgba(29,124,255,0.55)",   c1: "#2EA8FF", c2: "#0a3d80" },
    listening: { glow: "rgba(34,211,238,0.65)",   c1: "#22d3ee", c2: "#0a5a6e" },
    thinking:  { glow: "rgba(129,140,248,0.65)",  c1: "#818cf8", c2: "#312e81" },
    speaking:  { glow: "rgba(46,168,255,0.65)",   c1: "#2EA8FF", c2: "#0c3a6e" },
    alert:     { glow: "rgba(239,68,68,0.7)",     c1: "#f87171", c2: "#7f1d1d" },
  };
  const { glow, c1, c2 } = theme[mode] || theme.idle;

  return (
    <div className={`orb orb--${mode}`}>
      <div className="orb__ring orb__ring--3" style={{ borderColor: glow }} />
      <div className="orb__ring orb__ring--2" style={{ borderColor: glow }} />
      <div className="orb__ring orb__ring--1" style={{ borderColor: glow }} />
      <div
        className="orb__core"
        style={{
          background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.92) 0%, ${c1} 26%, ${c2} 60%, #020818 100%)`,
          boxShadow: `0 0 50px ${glow}, 0 0 100px ${glow.replace(/[\d.]+\)$/, "0.2)")}, inset 0 0 24px rgba(255,255,255,0.1)`,
        }}
      >
        <div className="orb__scan" />
        <div className="orb__glint" />
      </div>
      <div className="orb__bars">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.05}s`, background: c1 }} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────── AssistantMessage ─────────────────────────────
function AssistantMessage({ message }) {
  const { who, text, tag } = message;
  const tagClass = tag ? ` vg-msg--${tag}` : "";
  return (
    <div className={`vg-msg vg-msg--${who}${tagClass}`}>
      {(who === "bot" || who === "operator" || who === "system") && (
        <div className="vg-msg-label">
          {who === "bot"      && "VGUARDIAN AI"}
          {who === "operator" && "OPERADOR · MONITOREO"}
          {who === "system"   && "SISTEMA"}
        </div>
      )}
      <div className="vg-bubble">{text}</div>
    </div>
  );
}

// ──────────────────────────── QuickActions ────────────────────────────────
const ACTIONS = [
  {
    id: "visit", label: "Visita", text: "Vengo de visita al departamento",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
  {
    id: "delivery", label: "Delivery", text: "Tengo una entrega",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  },
  {
    id: "contacts", label: "Contactos", text: "¿Cuáles son los contactos del edificio?",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    id: "concierge", label: "Llamar a Conserje", text: "Quiero hablar con un operador",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.35 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.44 6.44l.96-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  },
  {
    id: "access", label: "Clave de Acceso", text: "Necesito una clave de acceso",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  },
];

function QuickActions({ onAction }) {
  return (
    <div className="vg-actions">
      <div className="vg-actions-row vg-actions-row--3">
        {ACTIONS.slice(0, 3).map((a) => (
          <button key={a.id} className="vg-action-btn" onClick={() => onAction(a.text)}>
            <span className="vg-action-icon">{a.icon}</span>
            <span className="vg-action-label">{a.label}</span>
          </button>
        ))}
      </div>
      <div className="vg-actions-row vg-actions-row--2">
        {ACTIONS.slice(3).map((a) => (
          <button key={a.id} className="vg-action-btn" onClick={() => onAction(a.text)}>
            <span className="vg-action-icon">{a.icon}</span>
            <span className="vg-action-label">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── ChatInput ──────────────────────────────────
function ChatInput({ value, onChange, onSend, onMic, listening, sttSupported }) {
  return (
    <div className="vg-composer">
      <button
        className={`vg-mic${listening ? " vg-mic--active" : ""}`}
        onClick={onMic}
        title={sttSupported ? "Hablar" : "Micrófono no disponible en este navegador"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
      <input
        className="vg-input"
        value={value}
        placeholder="Escriba su mensaje…"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSend(); }}
      />
      <button className="vg-send" onClick={onSend} aria-label="Enviar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}

// ───────────────────────────── ConciergeHeader ────────────────────────────
function ConciergeHeader({ clock }) {
  return (
    <header className="vg-header">
      <div className="vg-brand">
        <div className="vg-logo">v</div>
        <div>
          <div className="vg-brand-name">vGuardian</div>
          <div className="vg-brand-sub">CONSERJERÍA VIRTUAL</div>
        </div>
      </div>
      <div className="vg-header-right">
        <div className="vg-status">
          <span className="vg-status-dot" />
          En línea
        </div>
        <span className="vg-clock">
          {clock.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </header>
  );
}

// ───────────────────────────── PrivacyFooter ──────────────────────────────
function PrivacyFooter() {
  return (
    <footer className="vg-footer">
      Este punto registra audio y video para fines de seguridad.
      Tratamiento conforme a la Ley N° 19.628 de Protección de la Vida Privada (Chile).
    </footer>
  );
}

// ─────────────────────────── Main Totem component ─────────────────────────
export default function Totem() {
  const { supported, speak, cancelAudio, listen, stopListen } = useSpeech();
  const [screen,    setScreen]    = useState("welcome");
  const [avatar,    setAvatar]    = useState("idle");
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [listening, setListening] = useState(false);
  const [ctx,       setCtx]       = useState({ stage: null, resident: null });
  const [clock,     setClock]     = useState(new Date());
  const logRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const pushBot = useCallback((text, opts = {}) => {
    setMessages((m) => [...m, { who: "bot", text, ...opts }]);
    setAvatar("speaking");
    speak(text, () => setAvatar("idle"));
  }, [speak]);

  const pushUser = (text) => setMessages((m) => [...m, { who: "user", text }]);

  const greet = () => {
    const hour = new Date().getHours();
    const part = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
    const greeting = `${part}. Bienvenido a ${BUILDING.name}. Soy vGuardian, el conserje virtual. ¿En qué puedo ayudarle hoy?`;
    setScreen("session");
    setMessages([{ who: "bot", text: greeting }]);
    setCtx({ stage: null, resident: null });
    setAvatar("speaking");
    speak(greeting, () => setAvatar("idle"));
  };

  // ── Conversation reducer ──
  const handle = useCallback((raw) => {
    const text = raw.trim();
    if (!text) return;
    pushUser(text);
    setAvatar("thinking");

    setTimeout(() => {
      if (ctx.stage === "await_resident") {
        const r = findResident(text);
        if (!r) { pushBot("No logré identificar al residente. ¿Me indica el número de departamento o el nombre completo, por favor?"); return; }
        setCtx({ stage: "notifying", resident: r });
        pushBot(`Perfecto. Voy a contactar a ${r.name}, departamento ${r.apartment}. Un momento, por favor…`, { tag: "notify" });
        setTimeout(() => {
          const approved = r.autoApprove || Math.random() > 0.25;
          if (approved) {
            pushBot(`${r.name} autorizó su ingreso. Por favor diríjase al ascensor principal, piso ${r.apartment[0]}. Que tenga una excelente visita.`, { tag: "approved" });
            setCtx({ stage: "done", resident: r });
          } else {
            pushBot(`Lo siento, ${r.name} no se encuentra disponible y no autorizó el ingreso. ¿Desea que le contacte la conserjería?`, { tag: "rejected" });
            setCtx({ stage: "post_reject", resident: r });
          }
        }, 2600);
        return;
      }

      if (ctx.stage === "await_delivery_resident") {
        const r = findResident(text);
        if (!r) { pushBot("¿Para qué departamento es la entrega? Indíqueme el número, por favor."); return; }
        setCtx({ stage: "delivery_logged", resident: r });
        pushBot(`Registrada la entrega para ${r.name}, depto ${r.apartment}. Folio #${1000 + Math.floor(Math.random() * 9000)}. Puede dejar el paquete en el casillero inteligente N°4. ¡Gracias!`, { tag: "delivery" });
        return;
      }

      if (ctx.stage === "post_reject") {
        if (/(operador|conserj|si|claro|por favor|contact)/.test(norm(text))) {
          escalate("El residente rechazó el ingreso y el visitante solicita asistencia.");
        } else {
          pushBot("Entendido. He registrado la novedad. Que tenga un buen día.");
          setCtx({ stage: "done", resident: ctx.resident });
        }
        return;
      }

      const intent = classifyIntent(text);
      switch (intent) {
        case "greeting":
          pushBot("¡Hola! ¿Viene de visita, trae una entrega o necesita información?");
          break;
        case "visit": {
          const r = findResident(text);
          if (r) {
            setCtx({ stage: "notifying", resident: r });
            pushBot(`Entendido, busca a ${r.name} del depto ${r.apartment}. Lo contacto ahora…`, { tag: "notify" });
            setTimeout(() => {
              const approved = r.autoApprove || Math.random() > 0.25;
              if (approved) {
                pushBot(`${r.name} autorizó su ingreso. Diríjase al ascensor principal, piso ${r.apartment[0]}. Bienvenido.`, { tag: "approved" });
                setCtx({ stage: "done", resident: r });
              } else {
                pushBot(`${r.name} no autorizó el ingreso. ¿Desea que le contacte la conserjería?`, { tag: "rejected" });
                setCtx({ stage: "post_reject", resident: r });
              }
            }, 2600);
          } else {
            setCtx({ stage: "await_resident", resident: null });
            pushBot("Con gusto. ¿A qué residente o departamento desea visitar?");
          }
          break;
        }
        case "delivery":
          setCtx({ stage: "await_delivery_resident", resident: null });
          pushBot("Perfecto, una entrega. ¿Para qué departamento o residente es el paquete?", { tag: "delivery" });
          break;
        case "info": {
          const t = norm(text);
          let ans = `${BUILDING.name} está en ${BUILDING.address}.`;
          if (t.includes("piscina"))        ans = "La piscina está disponible de 8:00 a 22:00 hrs.";
          else if (t.includes("gimnasio"))  ans = "El gimnasio funciona de 6:00 a 23:00 hrs.";
          else if (t.includes("quincho"))   ans = "El quincho se reserva directamente en conserjería.";
          else if (t.includes("estacion"))  ans = "El estacionamiento de visitas está en el subterráneo -2, sectores V1 a V8.";
          else if (t.includes("wifi"))      ans = "La red de áreas comunes es vGuardian-Guest; la clave se solicita en conserjería.";
          pushBot(ans + " ¿Necesita algo más?");
          break;
        }
        case "emergency":
          setAvatar("alert");
          setMessages((m) => [...m, { who: "bot", text: "He detectado una posible emergencia. Estoy alertando de inmediato a la conserjería y al personal de seguridad. Mantenga la calma, ya viene ayuda.", tag: "alert" }]);
          speak("Emergencia detectada. Alertando a seguridad.");
          setTimeout(() => escalate("EMERGENCIA declarada por el visitante en el tótem.", true), 1500);
          break;
        case "escalate":
          escalate("El visitante solicita hablar con un operador.");
          break;
        default:
          pushBot("Disculpe, no comprendí bien. Puede decirme: «vengo al depto 302», «tengo una entrega» o «necesito información».");
      }
    }, 850);
  }, [ctx, pushBot, speak]);

  const escalate = (reason, urgent = false) => {
    setAvatar(urgent ? "alert" : "thinking");
    setMessages((m) => [...m, { who: "system", text: urgent ? "🚨 Escalando como PRIORIDAD ALTA al centro de monitoreo remoto…" : "Conectando con un operador del centro de monitoreo…" }]);
    setTimeout(() => {
      setMessages((m) => [...m, { who: "operator", text: "Hola, le habla Daniela del centro de monitoreo vGuardian. Ya tomé el control de la atención. ¿Me confirma su nombre, por favor?" }]);
      setAvatar("idle");
      setCtx({ stage: "with_operator", resident: ctx.resident });
    }, urgent ? 1200 : 2200);
  };

  const onMic = () => {
    if (!supported.stt) { handle("(El micrófono no está disponible en este navegador — use el teclado)"); return; }
    if (listening) { stopListen(); setListening(false); setAvatar("idle"); return; }
    setListening(true);
    setAvatar("listening");
    listen(
      (txt) => { setListening(false); handle(txt); },
      ()    => { setListening(false); setAvatar("idle"); }
    );
  };

  const endSession = () => {
    cancelAudio();
    setScreen("welcome");
    setMessages([]);
    setCtx({ stage: null, resident: null });
    setAvatar("idle");
  };

  const sendInput = () => { if (input.trim()) { handle(input); setInput(""); } };

  const stageLabel = {
    listening: "ESCUCHANDO…",
    thinking:  "PROCESANDO…",
    speaking:  "VGUARDIAN RESPONDE",
    alert:     "⚠ ALERTA ACTIVA",
    idle:      ctx.stage === "with_operator" ? "OPERADOR EN LÍNEA" : "LE ESCUCHO",
  }[avatar];

  return (
    <div className="vg-root">
      <style>{CSS}</style>
      <div className="vg-frame">

        <ConciergeHeader clock={clock} />

        {/* ── Welcome screen ── */}
        {screen === "welcome" ? (
          <main className="vg-welcome">
            <div className="vg-welcome-glow" />
            <AssistantOrb mode="idle" />
            <h1 className="vg-welcome-title">Bienvenido</h1>
            <p className="vg-welcome-building">{BUILDING.name}</p>
            <p className="vg-welcome-hint">Conserjería virtual inteligente · disponible 24/7</p>
            <button className="vg-cta" onClick={greet}>
              Toque para comenzar
            </button>
          </main>
        ) : (
          /* ── Session screen ── */
          <main className="vg-session">
            <div className="vg-stage">
              <AssistantOrb mode={avatar} />
              <div className="vg-stage-label">{stageLabel}</div>
            </div>

            <div className="vg-log" ref={logRef}>
              {messages.map((m, i) => <AssistantMessage key={i} message={m} />)}
            </div>

            <QuickActions onAction={handle} />

            <ChatInput
              value={input}
              onChange={setInput}
              onSend={sendInput}
              onMic={onMic}
              listening={listening}
              sttSupported={supported.stt}
            />

            <button className="vg-end" onClick={endSession}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
              </svg>
              FINALIZAR ATENCIÓN
            </button>
          </main>
        )}

        <PrivacyFooter />
      </div>
    </div>
  );
}

// ──────────────────────────────────── CSS ─────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.vg-root {
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(ellipse 130% 70% at 50% -5%, #0c1e3a 0%, #030712 55%);
  font-family: 'Inter', system-ui, sans-serif;
  color: #F8FAFC; padding: 12px;
}

.vg-frame {
  width: min(100%, 420px);
  max-height: 96vh;
  display: flex; flex-direction: column;
  border-radius: 28px;
  border: 1px solid rgba(59,130,246,0.18);
  background: linear-gradient(175deg, #0a1628 0%, #050b1a 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.04),
    0 0 80px rgba(29,124,255,0.1),
    0 50px 100px rgba(0,0,0,0.7);
  overflow: hidden;
}

/* ── ConciergeHeader ── */
.vg-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(59,130,246,0.1);
  background: rgba(5,11,26,0.92);
  backdrop-filter: blur(14px);
  flex-shrink: 0;
}

.vg-brand { display: flex; align-items: center; gap: 10px; }

.vg-logo {
  width: 38px; height: 38px; border-radius: 11px;
  background: linear-gradient(145deg, #1D7CFF, #0a3570);
  display: flex; align-items: center; justify-content: center;
  font-size: 19px; font-weight: 700; color: #fff;
  box-shadow: 0 4px 18px rgba(29,124,255,0.45);
  flex-shrink: 0;
}

.vg-brand-name  { font-size: 16px; font-weight: 700; letter-spacing: 0.2px; }
.vg-brand-sub   { font-size: 9px; font-weight: 500; color: #475569; letter-spacing: 2.5px; text-transform: uppercase; margin-top: 1px; }

.vg-header-right { display: flex; align-items: center; gap: 10px; }

.vg-status {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 9px; border-radius: 999px;
  border: 1px solid rgba(34,197,94,0.2);
  background: rgba(34,197,94,0.07);
  font-size: 11px; font-weight: 500; color: #22C55E;
}

.vg-status-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #22C55E; box-shadow: 0 0 8px #22C55E;
  animation: pulse-dot 2s infinite;
}

.vg-clock { font-size: 13px; font-weight: 600; color: #64748B; font-variant-numeric: tabular-nums; }

/* ── Welcome ── */
.vg-welcome {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; text-align: center;
  padding: 24px 28px; position: relative; overflow: hidden;
}

.vg-welcome-glow {
  position: absolute; inset: 0;
  background: radial-gradient(500px 400px at 50% 42%, rgba(29,124,255,0.13), transparent 70%);
  pointer-events: none;
}

.vg-welcome-title    { font-size: 44px; font-weight: 700; letter-spacing: -1.5px; margin-top: 26px; animation: rise .7s .1s both; }
.vg-welcome-building { font-size: 14px; color: #94A3B8; margin-top: 6px; animation: rise .7s .2s both; }
.vg-welcome-hint     { font-size: 11.5px; color: #475569; margin-top: 7px; letter-spacing: .3px; animation: rise .7s .3s both; }

.vg-cta {
  margin-top: 34px; padding: 17px 42px; border-radius: 999px;
  border: 1px solid rgba(29,124,255,0.38);
  background: linear-gradient(180deg, rgba(29,124,255,0.18), rgba(29,124,255,0.06));
  color: #F8FAFC; font-family: inherit; font-size: 16px; font-weight: 600;
  letter-spacing: .3px; cursor: pointer; backdrop-filter: blur(8px);
  transition: transform .2s, box-shadow .2s, border-color .2s;
  animation: rise .7s .4s both, glow-pulse 3s 1.4s infinite;
}
.vg-cta:hover  { transform: translateY(-2px); box-shadow: 0 16px 48px rgba(29,124,255,0.32); border-color: rgba(46,168,255,0.6); }
.vg-cta:active { transform: scale(0.97); }

.vg-welcome-foot { position: absolute; bottom: 20px; font-size: 10px; color: #334155; letter-spacing: .5px; }

/* ── Session ── */
.vg-session {
  flex: 1; display: flex; flex-direction: column;
  padding: 10px 14px 12px; min-height: 0; overflow: hidden;
}

.vg-stage        { display: flex; flex-direction: column; align-items: center; padding: 4px 0 2px; flex-shrink: 0; }
.vg-stage-label  { margin-top: 5px; font-size: 9.5px; font-weight: 600; color: #475569; letter-spacing: 2px; text-transform: uppercase; }

/* ── AssistantOrb ── */
.orb { position: relative; width: 130px; height: 130px; display: grid; place-items: center; }

.orb__ring { position: absolute; border-radius: 50%; border: 1px solid; }
.orb__ring--1 { width: 102px; height: 102px; animation: spin 12s linear infinite reverse;  opacity: .5; }
.orb__ring--2 { width: 118px; height: 118px; border-style: dashed; animation: spin 20s linear infinite; opacity: .3; }
.orb__ring--3 { width: 130px; height: 130px; border-style: dotted; animation: spin 8s linear infinite reverse; opacity: .18; }

.orb__core {
  width: 72px; height: 72px; border-radius: 50%; position: relative; overflow: hidden;
  transition: transform .4s, box-shadow .4s;
}

.orb__scan {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 42%, rgba(255,255,255,0.2) 50%, transparent 58%);
  animation: scan 3s linear infinite;
}

.orb__glint {
  position: absolute; top: 14%; left: 18%;
  width: 20px; height: 10px; border-radius: 50%;
  background: rgba(255,255,255,0.52); filter: blur(4px);
}

.orb__bars {
  position: absolute; bottom: -3px; display: flex; align-items: flex-end;
  gap: 2.5px; height: 24px; opacity: 0; transition: opacity .3s;
}
.orb__bars span { width: 2.5px; height: 5px; border-radius: 2px; }

.orb--speaking .orb__bars, .orb--listening .orb__bars { opacity: .85; }
.orb--speaking .orb__bars span { animation: eq .5s ease-in-out infinite alternate; }
.orb--listening .orb__bars span { animation: eq .35s ease-in-out infinite alternate; }
.orb--speaking .orb__core  { transform: scale(1.07); }
.orb--listening .orb__core { transform: scale(1.04); }
.orb--thinking .orb__ring--2 { animation-duration: 1.5s; }
.orb--idle .orb__core  { animation: breathe 4s ease-in-out infinite; }
.orb--alert .orb__core { animation: alert-pulse .6s ease-in-out infinite; }

/* ── AssistantMessage / log ── */
.vg-log {
  flex: 1; overflow-y: auto; margin: 8px 0 6px;
  display: flex; flex-direction: column; gap: 9px; padding-right: 3px; min-height: 0;
  scrollbar-width: thin; scrollbar-color: rgba(59,130,246,0.18) transparent;
}
.vg-log::-webkit-scrollbar { width: 3px; }
.vg-log::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.18); border-radius: 9px; }

.vg-msg         { display: flex; flex-direction: column; max-width: 90%; animation: rise .4s both; }
.vg-msg--user   { align-self: flex-end; align-items: flex-end; }

.vg-msg-label { font-size: 9px; font-weight: 600; color: #475569; letter-spacing: 1.8px; text-transform: uppercase; margin: 0 4px 3px; }

.vg-bubble {
  padding: 11px 14px; border-radius: 15px; font-size: 13.5px; line-height: 1.55;
  border: 1px solid rgba(59,130,246,0.18);
}

.vg-msg--bot      .vg-bubble { background: rgba(15,23,42,0.75); backdrop-filter: blur(8px); border-bottom-left-radius: 4px; }
.vg-msg--user     .vg-bubble { background: linear-gradient(145deg,#1D7CFF,#1254b5); border-color: transparent; color: #fff; border-bottom-right-radius: 4px; }
.vg-msg--operator .vg-bubble { background: rgba(34,197,94,0.08); border-color: rgba(34,197,94,0.28); }
.vg-msg--system   .vg-bubble { background: transparent; border-style: dashed; color: #475569; font-size: 12px; }
.vg-msg--alert    .vg-bubble { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.38); color: #fca5a5; }
.vg-msg--approved .vg-bubble { box-shadow: inset 0 0 0 1px rgba(34,197,94,0.22); }
.vg-msg--rejected .vg-bubble { box-shadow: inset 0 0 0 1px rgba(239,68,68,0.22); }
.vg-msg--notify   .vg-bubble { box-shadow: inset 0 0 0 1px rgba(29,124,255,0.22); }

/* ── QuickActions ── */
.vg-actions       { display: flex; flex-direction: column; gap: 7px; margin-bottom: 7px; flex-shrink: 0; }
.vg-actions-row   { display: grid; gap: 7px; }
.vg-actions-row--3 { grid-template-columns: repeat(3,1fr); }
.vg-actions-row--2 { grid-template-columns: repeat(2,1fr); }

.vg-action-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 13px 8px; border-radius: 15px;
  border: 1px solid rgba(59,130,246,0.2);
  background: rgba(15,23,42,0.6); backdrop-filter: blur(8px);
  color: #94A3B8; cursor: pointer; font-family: inherit;
  transition: transform .18s, border-color .18s, background .18s, box-shadow .18s, color .18s;
}
.vg-action-btn:hover  { transform: translateY(-2px); border-color: rgba(46,168,255,0.5); background: rgba(29,124,255,0.1); box-shadow: 0 8px 24px rgba(29,124,255,0.14); color: #2EA8FF; }
.vg-action-btn:active { transform: scale(0.95); }

.vg-action-icon  { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: #2EA8FF; }
.vg-action-icon svg { width: 100%; height: 100%; }
.vg-action-label { font-size: 11px; font-weight: 600; color: inherit; text-align: center; line-height: 1.2; }

/* ── ChatInput ── */
.vg-composer { display: flex; gap: 7px; align-items: center; margin-bottom: 7px; flex-shrink: 0; }

.vg-input {
  flex: 1; padding: 12px 15px; border-radius: 13px;
  border: 1px solid rgba(59,130,246,0.2);
  background: rgba(15,23,42,0.6); backdrop-filter: blur(8px);
  color: #F8FAFC; font-size: 14px; font-family: inherit; outline: none;
  transition: border-color .2s, background .2s;
}
.vg-input:focus    { border-color: rgba(46,168,255,0.48); background: rgba(15,23,42,0.85); }
.vg-input::placeholder { color: #334155; }

.vg-mic, .vg-send {
  width: 46px; height: 46px; border-radius: 13px;
  border: 1px solid rgba(59,130,246,0.2);
  background: rgba(15,23,42,0.6);
  color: #64748B; display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0; transition: .18s;
}
.vg-mic svg, .vg-send svg { width: 19px; height: 19px; }
.vg-mic:hover   { border-color: rgba(46,168,255,0.4); color: #2EA8FF; }
.vg-mic--active { background: rgba(34,211,238,0.1); border-color: #22d3ee; color: #22d3ee; animation: pulse-ring 1.3s infinite; }

.vg-send { background: linear-gradient(145deg,#1D7CFF,#1254b5); border-color: transparent; color: #fff; }
.vg-send:hover  { box-shadow: 0 4px 20px rgba(29,124,255,0.38); transform: translateY(-1px); }
.vg-send:active { transform: scale(0.95); }

/* ── End session ── */
.vg-end {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  align-self: center; margin-bottom: 4px;
  background: none; border: none; color: #334155;
  font-size: 10.5px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;
  cursor: pointer; padding: 5px 10px; transition: color .2s; font-family: inherit; flex-shrink: 0;
}
.vg-end:hover { color: #f87171; }

/* ── PrivacyFooter ── */
.vg-footer {
  font-size: 9px; color: #1e293b; text-align: center;
  padding: 9px 20px 11px; border-top: 1px solid rgba(59,130,246,0.07);
  line-height: 1.55; flex-shrink: 0;
}

/* ── Animations ── */
@keyframes spin        { to { transform: rotate(360deg); } }
@keyframes scan        { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
@keyframes eq          { from { height: 4px; } to { height: 20px; } }
@keyframes breathe     { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes alert-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@keyframes rise        { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes glow-pulse  { 0%,100% { box-shadow: 0 0 0 0 rgba(29,124,255,0.28); } 50% { box-shadow: 0 0 0 12px rgba(29,124,255,0); } }
@keyframes pulse-dot   { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
@keyframes pulse-ring  { 0%,100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.38); } 50% { box-shadow: 0 0 0 8px rgba(34,211,238,0); } }
`;
