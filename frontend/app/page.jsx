import Link from "next/link";

export default function Home() {
  return (
    <main style={styles.main}>
      <div style={styles.badge}>MVP 1.0</div>

      <div style={styles.logo}>
        <span style={styles.logoIcon}>⬡</span>
        <span style={styles.logoText}>v<strong>Guardian</strong></span>
      </div>

      <p style={styles.sub}>AI Concierge para Smart Buildings</p>

      <div style={styles.grid}>
        <Link href="/totem" style={styles.card}>
          <div style={styles.cardIcon}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="2" width="14" height="20" rx="2" />
              <circle cx="12" cy="17" r="1" />
            </svg>
          </div>
          <div>
            <div style={styles.cardTitle}>Tótem Virtual</div>
            <div style={styles.cardDesc}>Interfaz de voz y texto para visitantes. Avatar IA con motor conversacional completo.</div>
          </div>
          <div style={styles.cardArrow}>→</div>
        </Link>

        <Link href="/admin" style={{ ...styles.card, ...styles.cardAlt }}>
          <div style={{ ...styles.cardIcon, ...styles.cardIconAlt }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
          </div>
          <div>
            <div style={styles.cardTitle}>Panel Administrativo</div>
            <div style={styles.cardDesc}>Dashboard, residentes, visitas, conversaciones y operadores de teleasistencia.</div>
          </div>
          <div style={styles.cardArrow}>→</div>
        </Link>
      </div>

      <div style={styles.stack}>
        <span style={styles.tag}>Next.js</span>
        <span style={styles.tag}>Laravel 12</span>
        <span style={styles.tag}>PostgreSQL 16</span>
        <span style={styles.tag}>OpenAI</span>
        <span style={styles.tag}>WebSockets</span>
      </div>

      <div style={styles.footer}>InnovaDX · vGuardian</div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 20px",
    background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(30,80,220,0.18) 0%, #050810 70%)",
  },
  badge: {
    background: "rgba(46,139,255,0.15)",
    border: "1px solid rgba(46,139,255,0.35)",
    color: "#7eb8ff",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    padding: "4px 12px",
    borderRadius: "20px",
    marginBottom: "32px",
    textTransform: "uppercase",
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },
  logoIcon: {
    fontSize: "36px",
    color: "#2e8bff",
    lineHeight: 1,
  },
  logoText: {
    fontSize: "42px",
    fontWeight: 300,
    letterSpacing: "-0.02em",
    color: "#e8f0ff",
  },
  sub: {
    color: "#6b7f9e",
    fontSize: "15px",
    marginBottom: "56px",
    letterSpacing: "0.02em",
  },
  grid: {
    display: "flex",
    gap: "20px",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: "48px",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    width: "280px",
    padding: "28px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(46,139,255,0.25)",
    textDecoration: "none",
    color: "#e8f0ff",
    transition: "border-color 0.2s, background 0.2s",
    cursor: "pointer",
    position: "relative",
  },
  cardAlt: {
    border: "1px solid rgba(63,224,154,0.25)",
  },
  cardIcon: {
    width: "64px",
    height: "64px",
    borderRadius: "16px",
    background: "rgba(46,139,255,0.12)",
    border: "1px solid rgba(46,139,255,0.2)",
    display: "grid",
    placeItems: "center",
    color: "#2e8bff",
  },
  cardIconAlt: {
    background: "rgba(63,224,154,0.10)",
    border: "1px solid rgba(63,224,154,0.2)",
    color: "#3fe09a",
  },
  cardTitle: {
    fontSize: "17px",
    fontWeight: 600,
    marginBottom: "6px",
    color: "#e8f0ff",
  },
  cardDesc: {
    fontSize: "13px",
    color: "#6b7f9e",
    lineHeight: 1.6,
  },
  cardArrow: {
    fontSize: "20px",
    color: "#2e8bff",
    alignSelf: "flex-end",
  },
  stack: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: "40px",
  },
  tag: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#6b7f9e",
    fontSize: "11px",
    padding: "4px 10px",
    borderRadius: "6px",
  },
  footer: {
    color: "#2e3a52",
    fontSize: "12px",
  },
};
