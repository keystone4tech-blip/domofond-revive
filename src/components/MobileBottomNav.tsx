import { Home, Phone as PhoneIcon, Wrench, HelpCircle, User, LayoutDashboard, LogIn } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { AppRole } from "@/hooks/useUserRole";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  action: () => void;
  isActive?: boolean;
}

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    const fetchRoles = async (userId: string) => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      setUserRoles((data || []).map((r) => r.role as AppRole));
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchRoles(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchRoles(session.user.id), 0);
      } else {
        setUserRoles([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isFSMUser = userRoles.some((r) => 
    ["admin", "director", "dispatcher", "master", "engineer"].includes(r)
  );

  const scrollToSection = (sectionId: string) => {
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) element.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } else {
      const element = document.getElementById(sectionId);
      if (element) element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navItems: NavItem[] = [
    {
      icon: <Home className="h-5 w-5" />,
      label: "Главная",
      action: () => navigate("/"),
      isActive: location.pathname === "/",
    },
    {
      icon: <Wrench className="h-5 w-5" />,
      label: "Услуги",
      action: () => navigate("/domofony"),
      isActive: location.pathname === "/domofony" || location.pathname === "/videonablyudenie",
    },
    {
      icon: <PhoneIcon className="h-5 w-5" />,
      label: "Контакты",
      action: () => navigate("/kontakty"),
      isActive: location.pathname === "/kontakty",
    },
    {
      icon: <HelpCircle className="h-5 w-5" />,
      label: "Вопросы",
      action: () => navigate("/voprosy"),
      isActive: location.pathname === "/voprosy",
    },
  ];

  // Add FSM or Cabinet/Login button based on auth state
  if (user) {
    if (isFSMUser) {
      navItems.push({
        icon: <LayoutDashboard className="h-5 w-5" />,
        label: "FSM",
        action: () => navigate("/fsm"),
        isActive: location.pathname === "/fsm",
      });
    }
    navItems.push({
      icon: <User className="h-5 w-5" />,
      label: "Кабинет",
      action: () => navigate("/cabinet"),
      isActive: location.pathname === "/cabinet",
    });
  } else {
    navItems.push({
      icon: <LogIn className="h-5 w-5" />,
      label: "Войти",
      action: () => navigate("/auth"),
      isActive: location.pathname === "/auth",
    });
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.slice(0, 5).map((item, index) => (
          <button
            key={index}
            onClick={item.action}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
              item.isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
