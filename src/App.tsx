import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

          {/* Collaborator: chipeira management */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Customer: store & orders */}
          <Route path="/store" element={<Store />} />
          <Route path="/recharge" element={<Recharge />} />
          <Route path="/my-orders" element={<MyOrders />} />

          {/* Admin only */}
          <Route path="/admin" element={<Admin />} />

          {/* Legacy redirects (kept for compatibility) */}
          <Route path="/admin/orders" element={<Admin />} />
          <Route path="/order/:serviceId" element={<Store />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
