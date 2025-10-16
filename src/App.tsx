import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { XrozenAI } from "@/components/ai/XrozenAI";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import SharedProject from "./pages/SharedProject";
import VideoPreview from "./pages/VideoPreview";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import Admin from "./pages/Admin";
import Editors from "./pages/Editors";
import Clients from "./pages/Clients";
import Invoices from "./pages/Invoices";
import AdminUsers from "./pages/AdminUsers";
import AdminPlans from "./pages/AdminPlans";
import AdminAPI from "./pages/AdminAPI";
import AdminProjects from "./pages/AdminProjects";
import AdminPayments from "./pages/AdminPayments";
import AdminLogs from "./pages/AdminLogs";
import Settings from "./pages/Settings";
import EditorWorkSheet from "./pages/EditorWorkSheet";
import ClientWorkSheet from "./pages/ClientWorkSheet";
import XrozenAIPage from "./pages/XrozenAI";
import NotFound from "./pages/NotFound";
import SubscriptionSelect from "./pages/SubscriptionSelect";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminPlansManagement from "./pages/AdminPlansManagement";
import AdminSettings from "./pages/AdminSettings";
import AdminNotifications from "./pages/AdminNotifications";
import AdminDatabase from "./pages/AdminDatabase";
import AdminTables from "./pages/AdminTables";
import AdminQuery from "./pages/AdminQuery";
import AdminMigrations from "./pages/AdminMigrations";
import AdminBackups from "./pages/AdminBackups";
import AdminPerformance from "./pages/AdminPerformance";
import AdminAIModels from "./pages/AdminAIModels";
import Notifications from "./pages/Notifications";
import BillingHistory from "./pages/BillingHistory";
import SubscriptionManagement from "./pages/SubscriptionManagement";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Pricing from "./pages/Pricing";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:projectId" element={<ProjectDetails />} />
            <Route path="/shared/:shareToken" element={<SharedProject />} />
            <Route path="/video-preview/:versionId" element={<VideoPreview />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/database" element={<AdminDatabase />} />
            <Route path="/admin/tables" element={<AdminTables />} />
            <Route path="/admin/query" element={<AdminQuery />} />
            <Route path="/admin/migrations" element={<AdminMigrations />} />
            <Route path="/admin/backups" element={<AdminBackups />} />
            <Route path="/admin/performance" element={<AdminPerformance />} />
            <Route path="/admin/ai-models" element={<AdminAIModels />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/plans" element={<AdminPlans />} />
            <Route path="/admin/api" element={<AdminAPI />} />
            <Route path="/admin/projects" element={<AdminProjects />} />
            <Route path="/admin/payments" element={<AdminPayments />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
            <Route path="/admin/plans-management" element={<AdminPlansManagement />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/billing-history" element={<BillingHistory />} />
            <Route path="/subscription-select" element={<SubscriptionSelect />} />
            <Route path="/subscription-management" element={<SubscriptionManagement />} />
            <Route path="/editors" element={<Editors />} />
            <Route path="/editors/:editorId/worksheet" element={<EditorWorkSheet />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:clientId/worksheet" element={<ClientWorkSheet />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/xrozen-ai" element={<XrozenAIPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <XrozenAI />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
