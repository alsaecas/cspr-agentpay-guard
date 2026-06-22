"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Demo" },
  { href: "/policies", label: "Policies" },
  { href: "/payments", label: "Payments" },
  { href: "/merchants", label: "Merchants" },
  { href: "/audit", label: "Audit" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      <span className="nav-brand">⚡ CSPR AgentPay Guard</span>
      <span className="badge badge-mock">MOCK MODE</span>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`nav-link ${pathname === l.href ? "active" : ""}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
