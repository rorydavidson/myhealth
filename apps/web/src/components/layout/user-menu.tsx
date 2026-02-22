import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Settings, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { signOut, useSession } from "@/lib/auth-client";

export function UserMenu() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const { data: session } = useSession();

  if (!session?.user) return null;

  const user = session.user;
  const initials = (user.name ?? user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
        >
          {user.image ? (
            <img
              src={user.image}
              alt={user.name ?? ""}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[180px] rounded-lg border border-neutral-200 bg-white p-1 shadow-lg data-[state=open]:animate-fade-in dark:border-neutral-700 dark:bg-neutral-800"
        >
          <div className="px-3 py-2 text-sm">
            <p className="font-medium text-neutral-900 dark:text-neutral-50">{user.name}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{user.email}</p>
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 outline-none transition-colors hover:bg-neutral-100 focus:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
            onSelect={() => navigate({ to: "/settings" })}
          >
            <Settings className="h-4 w-4" />
            {t("nav.settings")}
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-700 outline-none transition-colors hover:bg-neutral-100 focus:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700"
            onSelect={() => navigate({ to: "/settings" })}
          >
            <User className="h-4 w-4" />
            {t("nav.profile")}
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />

          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 outline-none transition-colors hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 dark:focus:bg-red-900/20"
            onSelect={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            {t("actions.signOut")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
