import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SignOutIcon } from "@phosphor-icons/react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/prototype/site-chrome";
import { MemberShell } from "@/components/prototype/member-shell";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isAgent } = useRouteContext({ from: "/_authenticated" });
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  if (!isAdmin && !isAgent) return <MemberShell signOut={signOut}>{children}</MemberShell>;
  return (
    <div className="sn-member-layout">
      <SiteHeader
        privateNavigation
        staff
        controls={
          <button
            className="sn-button sn-button-small"
            type="button"
            aria-label="Sign out"
            onClick={signOut}
          >
            <SignOutIcon size={17} /> Sign out
          </button>
        }
      />
      <nav className="sn-staff-navigation" aria-label="Staff navigation">
        {(isAdmin
          ? [
              ["/admin/calls", "Call CRM"],
              ["/admin/agents", "Agents"],
            ]
          : [["/agent/console", "Agent console"]]
        ).map(([to, label]) => (
          <Link key={to} to={to}>
            {label}
          </Link>
        ))}
      </nav>
      <main id="app-content" className="sn-app-main">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  slogan,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  slogan?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="sn-page-header">
      <div>
        {eyebrow && (
          <p className="sn-page-eyebrow" data-page-eyebrow>
            {eyebrow}
          </p>
        )}
        <h1 data-page-headline>{title}</h1>
        <div data-page-sub>
          {slogan && <p className="sn-page-description">{slogan}</p>}
          {description && <p className="sn-page-description">{description}</p>}
        </div>
      </div>
      {children && <div data-page-cta>{children}</div>}
    </div>
  );
}
