"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  BookOpen,
  Layers3,
  ChartNoAxesCombined,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  CircleHelp,
  LogOut,
  Tv,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
const links = [
  { href: "/decks", name: "Decks", icon: Layers3 },
  { href: "/notebook", name: "Notebook", icon: BookOpen },
  { href: "/stats", name: "Stats", icon: ChartNoAxesCombined },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const [proTv, setProTv] = useState(false);
  useEffect(() => {
    if (!hasEnvVars) return;
    const client = createClient();
    Promise.all([
      client.from("pro_tv_settings").select("enabled").eq("id", true).single(),
      client.rpc("is_app_admin"),
    ]).then(([setting, admin]) =>
      setProTv(Boolean(setting.data?.enabled || admin.data)),
    );
  }, [path]);
  const navigation = proTv
    ? [...links, { href: "/pro-tv", name: "Pro TV", icon: Tv }]
    : links;
  if (path.startsWith("/auth"))
    return <div className="min-h-screen bg-background">{children}</div>;
  return (
    <div className="app-shell" data-collapsed={collapsed}>
      <aside className="sidebar">
        <Link href="/decks" className="brand" aria-label="TCG Helper home">
          <span className="brand-mark">
            <Layers3 size={23} />
          </span>
          {!collapsed && (
            <span>
              TCG{" "}
              <span className="font-normal text-muted-foreground">Helper</span>
            </span>
          )}
        </Link>
        {!collapsed && <p className="nav-caption">YOUR WORKSPACE</p>}
        <nav aria-label="Main navigation">
          {navigation.map(({ href, name, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={name}
              aria-current={path === href ? "page" : undefined}
              className={`nav-link ${path === href ? "active" : ""}`}
            >
              <Icon size={19} />
              {!collapsed && <span>{name}</span>}
              {!collapsed && path === href && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!collapsed && (
            <div className="sidebar-note">
              <CircleHelp size={18} />
              <p>
                Less to remember.
                <br />
                <strong>More room to play.</strong>
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            {!collapsed && "Collapse sidebar"}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            title="Switch color theme"
            aria-label="Switch color theme"
          >
            <Sun className="hidden dark:block" />
            <Moon className="dark:hidden" />
            {!collapsed && "Switch theme"}
          </Button>
          {hasEnvVars && (
            <Button
              variant="ghost"
              onClick={async () => {
                await createClient().auth.signOut();
                window.location.assign("/auth/login");
              }}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut />
              {!collapsed && "Sign out"}
            </Button>
          )}
          {!collapsed && (
            <div className="sidebar-footer">
              <span className="status-dot" />
              Pokémon TCG Live companion
            </div>
          )}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="text-muted-foreground">
            Workspace <span className="mx-3 text-border">/</span>
          </span>
          <span>
            {links.find((l) => l.href === path)?.name ?? "TCG Helper"}
          </span>
          <span className="ml-auto topbar-tag">TCG HELPER</span>
        </header>
        <main className="page-content">{children}</main>
        <footer className="page-footer">
          TCG Helper <span>Built for a clearer game.</span>
        </footer>
      </div>
    </div>
  );
}
