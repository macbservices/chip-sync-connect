import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RouteGuard } from "@/components/RouteGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Store from "./pages/Store";
import Recharge from "./pages/Recharge";
import MyOrders from "./pages/MyOrders";
import Admin from "./pages/Admin";
import NoAccess from "./pages/NoAccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/sem-acesso" element={<NoAccess />} />

          {/* Collaborator only: chipeira management + sales report */}
          <Route
            path="/dashboard"
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

          {/* Admin only */}
          <Route
            path="/admin"
            element={
              <RouteGuard allowedRoles={["admin"]}>
                <Admin />
              </RouteGuard>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
