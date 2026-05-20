"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

/**
 * eGuardian AI Concierge — TÓTEM VIRTUAL (MVP demo prototype)
 * --------------------------------------------------------------
 * Premium fullscreen interactive totem (target hardware: 1080x1920 portrait).
 * - Animated AI avatar (voice-reactive concentric energy field)
 * - Voice in/out via Web Speech API with graceful text fallback
 * - Deterministic intent engine simulating the OpenAI conversational core
 * - Full operational flow: greet -> intent -> resident lookup ->
 *   notify -> approve/reject -> response, plus delivery & human escalation
 *
 * In production the intent + NLG layer is replaced by the Laravel backend
 * calling OpenAI / Whisper / TTS (see backend/AiConciergeService.php).
 */

// ----------------------------- Mock data -----------------------------------
const RESIDENTS = [
  { id: 1, name: "Juan Pérez", apartment: "302", phone: "+56 9 7654 3210", autoApprove: false },
  { id: 2, name: "María González", apartment: "1204", phone: "+56 9 8123 4567", autoApprove: true },
  { id: 3, name: "Carlos Soto", apartment: "705", phone: "+56 9 6011 2233", autoApprove: false },
  { id: 4, name: "Valentina Rivas", apartment: "108", phone: "+56 9 9988 7766", autoApprove: false },
];

const BUILDING = {
  name: "Edificio Costanera Center",
  address: "Av. Andrés Bello 2425, Providencia",
  amenities: "piscina (8:00–22:00), gimnasio (6:00–23:00), quincho (reserva en conserjería)",
  parkingVisitas: "subterráneo -2, sectores V1–V8",
};

// --------------------------- Intent engine ---------------------------------
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

function findResident(text) {
  const t = norm(text);
  const aptMatch = t.match(/\b(depto|departamento|dpto|unidad|n°|nro|numero)?\s*0?(\d{2,4})\b/);
  if (aptMatch) {
    const apt = aptMatch[2];
    const r = RESIDENTS.find((x) => x.apartment === apt);
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
  if (/(ayuda|emergencia|incendio|fuego|socorro|robo|asalto|herido|policia|ambulancia)/.test(t))
    return "emergency";
  if (/(entrega|delivery|paquete|encomienda|pedido|amazon|mercadolibre|correos|repartidor)/.test(t))
    return "delivery";
  if (/(operador|conserje|conserjeria|persona real|humano|hablar con alguien|reclamo|queja)/.test(t))
    return "escalate";
  if (/(visita|vengo a|busco a|voy al|voy a ver|reunion|para el|al depto|departamento)/.test(t))
    return "visit";
  if (/(horario|piscina|gimnasio|quincho|estacionamiento|amenidad|direccion|donde queda|wifi)/.test(t))
    return "info";
  if (/(hola|buenas|buenos dias|buenas tardes|buenas noches|que tal)/.test(t) && t.length < 30)
    return "greeting";
  return "unknown";
}

// ------------------------------ Speech -------------------------------------
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
    // Pre-cargar voces al montar para que estén listas cuando el usuario hable
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
    u.onerror = (e) => { console.error("[TTS] error:", e.error); onEnd?.(); };

    // Preferir voz LOCAL (offline) — las voces "Natural"/"Online" requieren red y fallan en silencio
    const voices = synth.getVoices();
    const es = voices.filter((v) => /^es/i.test(v.lang));
    const best = es.find((v) => v.localService) || es[0];
    if (best) u.voice = best;

    console.log("[TTS] voice:", best?.name ?? "default", "local:", best?.localService ?? "?");
    synth.speak(u);
  }, []);

  const listen = useCallback((onResult, onError) => {
    const r = recRef.current;
    if (!r) { onError?.("unsupported"); return; }
    r.onresult = (e) => onResult(e.results[0][0].transcript);
    r.onerror = (e) => onError?.(e.error);
    try { r.start(); } catch (_) {}
  }, []);

  const stopListen = useCallback(() => {
    try { recRef.current?.stop(); } catch (_) {}
  }, []);

  return { supported, speak, cancelAudio, listen, stopListen };
}

// ------------------------------- Avatar ------------------------------------
function Avatar({ mode }) {
  // mode: idle | listening | thinking | speaking | alert
  const palette = {
    idle: "var(--accent)",
    listening: "#22d3ee",
    thinking: "#7c93ff",
    speaking: "var(--accent)",
    alert: "#ff5d6c",
  };
  const c = palette[mode] || "var(--accent)";
  return (
    <div className={`avatar avatar--${mode}`}>
      <div className="avatar__halo" style={{ borderColor: c }} />
      <div className="avatar__ring avatar__ring--1" style={{ borderColor: c }} />
      <div className="avatar__ring avatar__ring--2" style={{ borderColor: c }} />
      <div className="avatar__core" style={{ background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${c} 38%, #04122e 100%)` }}>
        <div className="avatar__scan" />
      </div>
      <div className="avatar__bars" aria-hidden>
        {Array.from({ length: 22 }).map((_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.045}s`, background: c }} />
        ))}
      </div>
    </div>
  );
}

// ------------------------------- App ---------------------------------------
const QUICK = [
  { label: "Tengo una visita", text: "Vengo de visita al departamento" },
  { label: "Soy delivery", text: "Tengo una entrega" },
  { label: "Información", text: "¿Cuál es el horario de la piscina?" },
  { label: "Hablar con conserjería", text: "Quiero hablar con un operador" },
];

export default function Totem() {
  const { supported, speak, cancelAudio, listen, stopListen } = useSpeech();
  const [online] = useState(true);
  const [screen, setScreen] = useState("welcome"); // welcome | session
  const [avatar, setAvatar] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [ctx, setCtx] = useState({ stage: null, resident: null }); // conversational context
  const [clock, setClock] = useState(new Date());
  const logRef = useRef(null);
  const idleTimer = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const pushBot = useCallback(
    (text, opts = {}) => {
      setMessages((m) => [...m, { who: "bot", text, ...opts }]);
      setAvatar("speaking");
      speak(text, () => setAvatar("idle"));
    },
    [speak]
  );
  const pushUser = (text) =>
    setMessages((m) => [...m, { who: "user", text }]);

  const greet = () => {
    const hour = new Date().getHours();
    const part = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
    const greeting = `${part}. Bienvenido a ${BUILDING.name}. Soy eGuardian, el conserje virtual. ¿En qué puedo ayudarle hoy?`;
    setScreen("session");
    setMessages([{ who: "bot", text: greeting }]);
    setCtx({ stage: null, resident: null });
    setAvatar("speaking");
    // Habla directamente en el gesto del usuario (sin setTimeout) para evitar bloqueos del navegador
    speak(greeting, () => setAvatar("idle"));
  };

  // ---- conversation reducer ------------------------------------------------
  const handle = useCallback(
    (raw) => {
      const text = raw.trim();
      if (!text) return;
      pushUser(text);
      setAvatar("thinking");

      setTimeout(() => {
        // Multi-turn: awaiting resident for a visit/delivery
        if (ctx.stage === "await_resident") {
          const r = findResident(text);
          if (!r) {
            pushBot(
              "No logré identificar al residente. ¿Me indica el número de departamento o el nombre completo, por favor?"
            );
            return;
          }
          setCtx({ stage: "notifying", resident: r });
          pushBot(
            `Perfecto. Voy a contactar a ${r.name}, departamento ${r.apartment}. Un momento, por favor…`,
            { tag: "notify" }
          );
          // Simulate push notification to resident app + response
          setTimeout(() => {
            const approved = r.autoApprove || Math.random() > 0.25;
            if (approved) {
              pushBot(
                `${r.name} autorizó su ingreso. Por favor diríjase al ascensor principal, piso ${r.apartment[0]}. Que tenga una excelente visita.`,
                { tag: "approved" }
              );
              setCtx({ stage: "done", resident: r });
            } else {
              pushBot(
                `Lo siento, ${r.name} no se encuentra disponible en este momento y no autorizó el ingreso. ¿Desea dejar un mensaje o que le contacte la conserjería?`,
                { tag: "rejected" }
              );
              setCtx({ stage: "post_reject", resident: r });
            }
          }, 2600);
          return;
        }

        if (ctx.stage === "await_delivery_resident") {
          const r = findResident(text);
          if (!r) {
            pushBot("¿Para qué departamento es la entrega? Indíqueme el número, por favor.");
            return;
          }
          setCtx({ stage: "delivery_logged", resident: r });
          pushBot(
            `Registrada la entrega para ${r.name}, depto ${r.apartment}. Notifiqué al residente y dejé el registro con folio #${1000 + Math.floor(Math.random() * 9000)}. Puede dejar el paquete en el casillero inteligente N°4. ¡Gracias!`,
            { tag: "delivery" }
          );
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

        // First-turn intent classification
        const intent = classifyIntent(text);
        switch (intent) {
          case "greeting":
            pushBot("¡Hola! ¿Viene de visita, trae una entrega o necesita información?");
            break;
          case "visit": {
            const r = findResident(text);
            if (r) {
              setCtx({ stage: "notifying", resident: r });
              pushBot(`Entendido, busca a ${r.name} del departamento ${r.apartment}. Lo contacto ahora…`, { tag: "notify" });
              setTimeout(() => {
                const approved = r.autoApprove || Math.random() > 0.25;
                if (approved) {
                  pushBot(`${r.name} autorizó su ingreso. Diríjase al ascensor principal, piso ${r.apartment[0]}. Bienvenido.`, { tag: "approved" });
                  setCtx({ stage: "done", resident: r });
                } else {
                  pushBot(`${r.name} no autorizó el ingreso en este momento. ¿Desea que le contacte la conserjería?`, { tag: "rejected" });
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
            if (t.includes("piscina")) ans = "La piscina está disponible de 8:00 a 22:00 hrs.";
            else if (t.includes("gimnasio")) ans = "El gimnasio funciona de 6:00 a 23:00 hrs.";
            else if (t.includes("quincho")) ans = "El quincho se reserva directamente en conserjería.";
            else if (t.includes("estacionamiento")) ans = `El estacionamiento de visitas está en el subterráneo -2, sectores V1 a V8.`;
            else if (t.includes("wifi")) ans = "La red de áreas comunes es eGuardian-Guest; la clave se solicita en conserjería.";
            pushBot(ans + " ¿Necesita algo más?");
            break;
          }
          case "emergency":
            setAvatar("alert");
            setMessages((m) => [
              ...m,
              { who: "bot", text: "He detectado una posible emergencia. Estoy alertando de inmediato a la conserjería y al personal de seguridad. Mantenga la calma, ya viene ayuda.", tag: "alert" },
            ]);
            speak("Emergencia detectada. Alertando a seguridad.");
            setTimeout(() => escalate("EMERGENCIA declarada por el visitante en el tótem.", true), 1500);
            break;
          case "escalate":
            escalate("El visitante solicita explícitamente hablar con un operador.");
            break;
          default:
            pushBot("Disculpe, no comprendí bien. Puede decirme, por ejemplo: «vengo al depto 302», «tengo una entrega» o «necesito información».");
        }
      }, 850);
    },
    [ctx, pushBot, speak]
  );

  const escalate = (reason, urgent = false) => {
    setAvatar(urgent ? "alert" : "thinking");
    setMessages((m) => [
      ...m,
      {
        who: "system",
        text: urgent
          ? "🚨 Escalando como PRIORIDAD ALTA al centro de monitoreo remoto…"
          : "Conectando con un operador del centro de monitoreo…",
      },
    ]);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          who: "operator",
          text:
            "Hola, le habla Daniela del centro de monitoreo eGuardian. Ya tomé el control de la atención y estoy revisando su caso. ¿Me confirma su nombre, por favor?",
        },
      ]);
      setAvatar("idle");
      setCtx({ stage: "with_operator", resident: ctx.resident });
    }, urgent ? 1200 : 2200);
  };

  const onMic = () => {
    if (!supported.stt) {
      handle("(El micrófono no está disponible en este navegador — use el teclado)");
      return;
    }
    if (listening) {
      stopListen();
      setListening(false);
      setAvatar("idle");
      return;
    }
    setListening(true);
    setAvatar("listening");
    listen(
      (txt) => {
        setListening(false);
        handle(txt);
      },
      () => {
        setListening(false);
        setAvatar("idle");
      }
    );
  };

  const endSession = () => {
    cancelAudio();
    setScreen("welcome");
    setMessages([]);
    setCtx({ stage: null, resident: null });
    setAvatar("idle");
  };

  return (
    <div className="totem-root">
      <style>{CSS}</style>
      <div className="totem-frame">
        {/* ---------------- Top status bar ---------------- */}
        <header className="bar">
          <div className="brand">
            <span className="brand__mark">e</span>
            <div>
              <div className="brand__name">eGuardian</div>
              <div className="brand__sub">AI Concierge</div>
            </div>
          </div>
          <div className="bar__right">
            <span className={`pill ${online ? "pill--on" : "pill--off"}`}>
              <i /> {online ? "En línea" : "Sin conexión"}
            </span>
            <span className="clock">
              {clock.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </header>

        {screen === "welcome" ? (
          <main className="welcome">
            <div className="welcome__glow" />
            <Avatar mode="idle" />
            <h1 className="welcome__title">Bienvenido</h1>
            <p className="welcome__sub">{BUILDING.name}</p>
            <p className="welcome__hint">Conserjería virtual inteligente · disponible 24/7</p>
            <button className="cta" onClick={greet}>
              <span>Toque para comenzar</span>
            </button>
            <div className="welcome__foot">
              {supported.stt ? "Atención por voz y texto" : "Atención por texto"} · datos protegidos (Ley 19.628)
            </div>
          </main>
        ) : (
          <main className="session">
            <div className="stage">
              <Avatar mode={avatar} />
              <div className="stage__state">
                {avatar === "listening" && "Escuchando…"}
                {avatar === "thinking" && "Procesando…"}
                {avatar === "speaking" && "eGuardian responde"}
                {avatar === "alert" && "⚠ Alerta activa"}
                {avatar === "idle" && (ctx.stage === "with_operator" ? "Operador en línea" : "Le escucho")}
              </div>
            </div>

            <div className="log" ref={logRef}>
              {messages.map((m, i) => (
                <div key={i} className={`msg msg--${m.who} ${m.tag ? "msg--" + m.tag : ""}`}>
                  {(m.who === "bot" || m.who === "operator" || m.who === "system") && (
                    <div className="msg__who">
                      {m.who === "bot" && "eGuardian AI"}
                      {m.who === "operator" && "Operador · Monitoreo"}
                      {m.who === "system" && "Sistema"}
                    </div>
                  )}
                  <div className="msg__bubble">{m.text}</div>
                </div>
              ))}
            </div>

            <div className="quick">
              {QUICK.map((q) => (
                <button key={q.label} onClick={() => handle(q.text)} className="chip">
                  {q.label}
                </button>
              ))}
            </div>

            <div className="composer">
              <button
                className={`mic ${listening ? "mic--active" : ""}`}
                onClick={onMic}
                aria-label="Hablar"
                title={supported.stt ? "Hablar" : "Micrófono no soportado en este navegador"}
              >
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
              </button>
              <input
                className="field"
                value={input}
                placeholder="Escriba su mensaje…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && input.trim()) {
                    handle(input);
                    setInput("");
                  }
                }}
              />
              <button
                className="send"
                onClick={() => {
                  if (input.trim()) {
                    handle(input);
                    setInput("");
                  }
                }}
                aria-label="Enviar"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12h15M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>

            <button className="end" onClick={endSession}>
              Finalizar atención
            </button>
          </main>
        )}

        <footer className="legal">
          Este punto registra audio y video para fines de seguridad. Tratamiento conforme a la Ley N° 19.628 de Chile.
        </footer>
      </div>
    </div>
  );
}

// ------------------------------- Styles ------------------------------------
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600&display=swap');

.totem-root{
  --bg:#03060f; --bg2:#04122e; --panel:rgba(255,255,255,.05);
  --stroke:rgba(255,255,255,.10); --accent:#2e8bff; --accent2:#19e0ff;
  --text:#eaf1ff; --muted:#7d8db5;
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  background:radial-gradient(1200px 900px at 50% -10%, #0a1b3d 0%, var(--bg) 60%);
  font-family:'Manrope',system-ui,sans-serif; color:var(--text); padding:18px;
}
.totem-frame{
  width:min(100%,520px); aspect-ratio:1080/1920; max-height:96vh;
  position:relative; display:flex; flex-direction:column;
  border:1px solid var(--stroke); border-radius:30px; overflow:hidden;
  background:linear-gradient(180deg,#050b1c 0%,#020611 100%);
  box-shadow:0 50px 120px -30px #000, inset 0 1px 0 rgba(255,255,255,.06);
}
.bar{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--stroke);backdrop-filter:blur(10px)}
.brand{display:flex;align-items:center;gap:12px}
.brand__mark{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;font-family:'Sora';font-weight:700;font-size:22px;color:#fff;background:linear-gradient(145deg,var(--accent),#0c3a8a);box-shadow:0 8px 24px -8px var(--accent)}
.brand__name{font-family:'Sora';font-weight:600;font-size:17px;letter-spacing:.5px}
.brand__sub{font-size:11px;color:var(--muted);letter-spacing:3px;text-transform:uppercase}
.bar__right{display:flex;align-items:center;gap:14px}
.pill{display:flex;align-items:center;gap:7px;font-size:12px;padding:7px 12px;border-radius:999px;border:1px solid var(--stroke);background:var(--panel)}
.pill i{width:7px;height:7px;border-radius:50%}
.pill--on i{background:#27e08a;box-shadow:0 0 10px #27e08a}
.pill--on{color:#9be9c4}
.pill--off i{background:#ff5d6c}
.clock{font-family:'Sora';font-size:14px;color:var(--muted);font-variant-numeric:tabular-nums}

/* Welcome */
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;padding:30px}
.welcome__glow{position:absolute;inset:0;background:radial-gradient(420px 420px at 50% 38%,rgba(46,139,255,.18),transparent 70%);pointer-events:none}
.welcome__title{font-family:'Sora';font-weight:700;font-size:46px;margin:30px 0 6px;letter-spacing:-1px;animation:rise .8s .1s both}
.welcome__sub{font-size:20px;color:#cfe0ff;animation:rise .8s .2s both}
.welcome__hint{font-size:13px;color:var(--muted);margin-top:10px;letter-spacing:.4px;animation:rise .8s .3s both}
.cta{margin-top:46px;padding:20px 46px;border-radius:999px;border:1px solid rgba(46,139,255,.5);background:linear-gradient(180deg,rgba(46,139,255,.22),rgba(46,139,255,.06));color:#fff;font-family:'Sora';font-size:17px;font-weight:600;letter-spacing:.4px;cursor:pointer;backdrop-filter:blur(8px);transition:.25s;animation:rise .8s .4s both, pulse 3s 1.4s infinite}
.cta:hover{transform:translateY(-2px);box-shadow:0 18px 50px -16px var(--accent)}
.welcome__foot{position:absolute;bottom:26px;font-size:11px;color:var(--muted);letter-spacing:.5px}

/* Session */
.session{flex:1;display:flex;flex-direction:column;padding:14px 20px 18px;min-height:0}
.stage{display:flex;flex-direction:column;align-items:center;padding:8px 0 4px}
.stage__state{margin-top:8px;font-size:13px;color:var(--muted);letter-spacing:1px;text-transform:uppercase}
.log{flex:1;overflow-y:auto;margin:12px 0;display:flex;flex-direction:column;gap:14px;padding-right:6px;scrollbar-width:thin}
.log::-webkit-scrollbar{width:5px}.log::-webkit-scrollbar-thumb{background:var(--stroke);border-radius:9px}
.msg{display:flex;flex-direction:column;max-width:88%;animation:rise .5s both}
.msg--user{align-self:flex-end;align-items:flex-end}
.msg__who{font-size:10.5px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin:0 4px 5px}
.msg__bubble{padding:14px 17px;border-radius:18px;font-size:15px;line-height:1.5;border:1px solid var(--stroke)}
.msg--bot .msg__bubble{background:var(--panel);border-bottom-left-radius:5px}
.msg--user .msg__bubble{background:linear-gradient(145deg,var(--accent),#1456b8);border-bottom-right-radius:5px;color:#fff;border-color:transparent}
.msg--operator .msg__bubble{background:rgba(39,224,138,.10);border-color:rgba(39,224,138,.35)}
.msg--system .msg__bubble{background:transparent;border-style:dashed;color:var(--muted);font-size:13px}
.msg--alert .msg__bubble{background:rgba(255,93,108,.12);border-color:rgba(255,93,108,.45);color:#ffd5d9}
.msg--approved .msg__bubble{box-shadow:0 0 0 1px rgba(39,224,138,.3) inset}
.msg--rejected .msg__bubble{box-shadow:0 0 0 1px rgba(255,93,108,.3) inset}

.quick{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.chip{padding:9px 14px;border-radius:999px;border:1px solid var(--stroke);background:var(--panel);color:#cfe0ff;font-size:12.5px;cursor:pointer;transition:.2s;font-family:'Manrope'}
.chip:hover{border-color:var(--accent);color:#fff;background:rgba(46,139,255,.14)}
.composer{display:flex;gap:10px;align-items:center}
.field{flex:1;padding:15px 18px;border-radius:16px;border:1px solid var(--stroke);background:rgba(255,255,255,.04);color:var(--text);font-size:15px;font-family:'Manrope';outline:none;transition:.2s}
.field:focus{border-color:var(--accent);background:rgba(46,139,255,.08)}
.field::placeholder{color:var(--muted)}
.mic,.send{width:52px;height:52px;border-radius:16px;border:1px solid var(--stroke);background:var(--panel);color:#cfe0ff;display:grid;place-items:center;cursor:pointer;transition:.2s;flex-shrink:0}
.mic:hover,.send:hover{border-color:var(--accent);color:#fff}
.send{background:linear-gradient(145deg,var(--accent),#1456b8);border-color:transparent;color:#fff}
.mic--active{background:rgba(34,211,238,.18);border-color:#22d3ee;color:#22d3ee;animation:pulse 1.3s infinite}
.end{margin-top:14px;align-self:center;background:none;border:none;color:var(--muted);font-size:12.5px;letter-spacing:1px;text-transform:uppercase;cursor:pointer;padding:6px 10px}
.end:hover{color:#ff8a93}
.legal{font-size:10px;color:#4d5b80;text-align:center;padding:12px 22px;border-top:1px solid var(--stroke);line-height:1.5}

/* Avatar */
.avatar{position:relative;width:190px;height:190px;display:grid;place-items:center}
.avatar__core{width:96px;height:96px;border-radius:50%;position:relative;overflow:hidden;box-shadow:0 0 50px -6px var(--accent),inset 0 0 22px rgba(255,255,255,.25);transition:.4s}
.avatar__scan{position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(255,255,255,.28) 50%,transparent 55%);animation:scan 3.2s linear infinite}
.avatar__ring,.avatar__halo{position:absolute;border-radius:50%;border:1px solid;opacity:.4}
.avatar__halo{width:188px;height:188px;border-style:dashed;animation:spin 28s linear infinite;opacity:.22}
.avatar__ring--1{width:140px;height:140px;animation:spin 14s linear infinite reverse;opacity:.5}
.avatar__ring--2{width:118px;height:118px;border-style:dotted;animation:spin 9s linear infinite;opacity:.35}
.avatar__bars{position:absolute;bottom:-2px;display:flex;align-items:flex-end;gap:3px;height:30px;opacity:0;transition:.3s}
.avatar__bars span{width:3px;height:6px;border-radius:3px}
.avatar--speaking .avatar__bars,.avatar--listening .avatar__bars{opacity:.9}
.avatar--speaking .avatar__bars span{animation:eq .55s ease-in-out infinite alternate}
.avatar--listening .avatar__bars span{animation:eq .35s ease-in-out infinite alternate}
.avatar--speaking .avatar__core{transform:scale(1.05)}
.avatar--listening .avatar__core{transform:scale(1.03)}
.avatar--thinking .avatar__ring--2{animation-duration:1.6s}
.avatar--idle .avatar__core{animation:breathe 4s ease-in-out infinite}
.avatar--alert .avatar__core{animation:alert .6s ease-in-out infinite}

@keyframes spin{to{transform:rotate(360deg)}}
@keyframes scan{0%{transform:translateY(-100%)}100%{transform:translateY(100%)}}
@keyframes eq{from{height:5px}to{height:26px}}
@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
@keyframes alert{0%,100%{transform:scale(1);box-shadow:0 0 50px -6px #ff5d6c}50%{transform:scale(1.06);box-shadow:0 0 70px 0 #ff5d6c}}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(46,139,255,.4)}50%{box-shadow:0 0 0 14px rgba(46,139,255,0)}}
`;
