import { Outlet, NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BookOpen, Settings, PenLine } from "lucide-react";
import TaskBar from "@/components/TaskBar";

const navItems = [
  { to: "/", label: "项目", icon: BookOpen },
  { to: "/settings", label: "设置", icon: Settings },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-6">
            <NavLink to="/" className="flex items-center gap-2 font-bold text-lg">
              <PenLine className="h-5 w-5 text-primary" />
              Nova
            </NavLink>
            <nav className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-16">
        <Outlet />
      </main>

      {/* Global Task Bar (background tasks) */}
      <TaskBar />
    </div>
  );
}
