import { Link, useLocation } from "react-router-dom";
import {
  Lightbulb,
  LayoutDashboard,
  List,
  GitCompare,
  MessageSquare,
  User,
  Activity,
  Sparkles,
  Bot,
  Bell,
  Workflow,
  Database,
  FolderKanban,
} from "lucide-react";
import clsx from "clsx";

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Ideate", href: "/ideate", icon: Sparkles, highlight: true },
  { name: "Ideas", href: "/ideas", icon: List },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Compare", href: "/compare", icon: GitCompare },
  { name: "Debates", href: "/debate", icon: MessageSquare },
  { name: "Objects", href: "/objects", icon: Database },
  { name: "Observability", href: "/observability", icon: Activity },
  { name: "Pipeline", href: "/pipeline", icon: Workflow },
  { name: "Agents", href: "/agents", icon: Bot },
  { name: "Profile", href: "/profile", icon: User },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Fixed */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo */}
              <Link to="/" className="flex items-center">
                <Lightbulb className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">
                  Idea Incubator
                </span>
              </Link>

              {/* Navigation */}
              <nav className="hidden sm:ml-8 sm:flex sm:space-x-4">
                {navigation.map((item) => {
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== "/" &&
                      location.pathname.startsWith(item.href));
                  const isHighlight = "highlight" in item && item.highlight;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={clsx(
                        "inline-flex items-center px-3 py-2 text-sm font-medium rounded-md",
                        isActive
                          ? "bg-primary-50 text-primary-700"
                          : isHighlight
                            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                      )}
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Settings/Notifications */}
            <div className="flex items-center">
              <Link
                to="/settings/notifications"
                className={clsx(
                  "p-2 rounded-md transition",
                  location.pathname.startsWith("/settings")
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100",
                )}
                title="Notification Settings"
              >
                <Bell className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main content - pt-16 accounts for fixed header */}
      <main className="px-4 sm:px-6 lg:px-8 pt-16 pb-6">{children}</main>
    </div>
  );
}
