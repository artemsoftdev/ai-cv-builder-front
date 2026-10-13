"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api/error-messages";
import { HOME_PATH } from "@/lib/auth/paths";
import { useLogout, useMe } from "@/lib/query/auth-hooks";

import { WIDE_PAGE } from "./wide-page";

export function AppHeader() {
  const me = useMe();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onError: (error) => toast.error("Couldn't log out", { description: getErrorMessage(error) }),
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-canvas/80 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/70">
      <div className={`mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6 ${WIDE_PAGE}`}>
        <Link href={HOME_PATH} className="-ml-1 shrink-0 rounded-lg p-1" aria-label="CV Builder, go to your CVs">
          <Logo />
        </Link>

        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-3">
          {me.isPending ? (
            <Skeleton className="h-4 w-28 sm:w-40" />
          ) : me.data ? (
            <span className="min-w-0 truncate text-sm text-fg-muted" title={me.data.email}>
              {me.data.email}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            loading={logout.isPending || logout.isSuccess}
            leftIcon={<LogOut aria-hidden="true" className="size-4" />}
            aria-label="Log out"
            className="min-w-10 px-2.5 sm:px-3.5"
          >
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
