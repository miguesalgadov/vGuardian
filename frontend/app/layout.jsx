export const metadata = {
  title: "vGuardian — AI Concierge",
  description: "Conserje virtual inteligente para Smart Buildings",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, background: "#050810", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
