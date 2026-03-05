import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { RouteGuard } from "@/components/RouteGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ChooseRole from "./pages/ChooseRole";
import Dashboard from "./pages/Dashboard";
import Store from "./pages/Store";
import Recharge from "./pages/Recharge";
import MyOrders from "./pages/MyOrders";
import Admin from "./pages/Admin";
import NoAccess from "./pages/NoAccess";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Support from "./pages/Support";
import Affiliate from "./pages/Affiliate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/escolher-perfil" element={<ChooseRole />} />
          <Route path="/sem-acesso" element={<NoAccess />} />
          <Route path="/termos" element={<Terms />} />
          <Route path="/privacidade" element={<Privacy />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/esqueci-senha" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Collaborator only: chipeira management + sales report */}
          <Route
            path="/dashboard"
            element={
              <RouteGuard allowedRoles={["collaborator", "admin"]}>
                <Dashboard />
              </RouteGuard>
            }
          />
          <Route
            path="/colaborador"
            element={
              <RouteGuard allowedRoles={["collaborator", "admin"]}>
                <Dashboard />
              </RouteGuard>
            }
          />

          {/* Customer only: store & recharge */}
          <Route
            path="/store"
            element={
              <RouteGuard allowedRoles={["customer", "admin"]}>
                <Store />
              </RouteGuard>
            }
          />
          <Route
            path="/recharge"
            element={
              <RouteGuard allowedRoles={["customer", "admin"]}>
                <Recharge />
              </RouteGuard>
            }
          />
          <Route
            path="/my-orders"
            element={
              <RouteGuard allowedRoles={["customer", "admin"]}>
                <MyOrders />
              </RouteGuard>
            }
          />
          <Route
            path="/suporte"
            element={
              <RouteGuard allowedRoles={["customer", "admin"]}>
                <Support />
              </RouteGuard>
            }
          />

          {/* Admin only */}
          <Route
            path="/admin"
            element={
              <RouteGuard allowedRoles={["admin"]}>
                <Admin />
              </RouteGuard>
            }
          />

          {/* Affiliate page (no RouteGuard, checks internally) */}
          <Route path="/afiliado" element={<Affiliate />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
