import "./globals.css";

export const metadata = {
  title: "CSPR AgentPay Guard",
  description: "Policy-controlled payment firewall for autonomous agents.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
