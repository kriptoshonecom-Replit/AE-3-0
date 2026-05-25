import { Switch, Route, Redirect } from "wouter";
import { Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { GlobalNavProvider } from "@/context/GlobalNavContext";
import GlobalNav from "@/components/GlobalNav";
import QuoteBuilder from "@/pages/QuoteBuilder";
import SignInPage from "@/pages/SignInPage";
import SignUpPage from "@/pages/SignUpPage";
import ProfilePage from "@/pages/ProfilePage";
import UsersPage from "@/pages/UsersPage";
import ProductsConfigPage from "@/pages/ProductsConfigPage";
import PitConfigPage from "@/pages/PitConfigPage";
import MediaFilesPage from "@/pages/MediaFilesPage";
import AlertConfigPage from "@/pages/AlertConfigPage";
import StatusPassConfigPage from "@/pages/StatusPassConfigPage";
import QuoteLibraryPage from "@/pages/QuoteLibraryPage";
import MyQuoteLibraryPage from "@/pages/MyQuoteLibraryPage";
import AmendmentsPage from "@/pages/AmendmentsPage";
import DashboardPage from "@/pages/DashboardPage";
import LogJournalPage from "@/pages/LogJournalPage";
import AppReleasePage from "@/pages/AppReleasePage";
import CDMPage from "@/pages/CDMPage";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function LoadingScreen() {
  return (
    <div className="profile-loading">
      <div className="spinner" />
    </div>
  );
}

function HomeRoute() {
  const { user, isLoaded } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!user) return <Redirect to="/sign-in" />;
  return <QuoteBuilder />;
}

function ProtectedProfile() {
  const { user, isLoaded } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!user) return <Redirect to="/sign-in" />;
  return <ProfilePage />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!user) return <Redirect to="/sign-in" />;
  if (user.role !== "admin") return <Redirect to="/" />;
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!user) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <GlobalNavProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <GlobalNav />
        <Switch>
          <Route path="/" component={HomeRoute} />
          <Route path="/sign-in" component={SignInPage} />
          <Route path="/sign-up" component={SignUpPage} />
          <Route path="/profile" component={ProtectedProfile} />
          <Route path="/admin/users">
            <AdminRoute><UsersPage /></AdminRoute>
          </Route>
          <Route path="/admin/products">
            <AdminRoute><ProductsConfigPage /></AdminRoute>
          </Route>
          <Route path="/admin/pit">
            <AdminRoute><PitConfigPage /></AdminRoute>
          </Route>
          <Route path="/admin/media">
            <AdminRoute><MediaFilesPage /></AdminRoute>
          </Route>
          <Route path="/admin/alerts">
            <AdminRoute><AlertConfigPage /></AdminRoute>
          </Route>
          <Route path="/admin/status-pass">
            <AdminRoute><StatusPassConfigPage /></AdminRoute>
          </Route>
          <Route path="/my-quotes">
            <ProtectedRoute><MyQuoteLibraryPage /></ProtectedRoute>
          </Route>
          <Route path="/amendments">
            <ProtectedRoute><AmendmentsPage /></ProtectedRoute>
          </Route>
          <Route path="/admin/dashboard">
            <AdminRoute><DashboardPage /></AdminRoute>
          </Route>
          <Route path="/admin/quote-library">
            <AdminRoute><QuoteLibraryPage /></AdminRoute>
          </Route>
          <Route path="/admin/log-journal">
            <AdminRoute><LogJournalPage /></AdminRoute>
          </Route>
          <Route path="/admin/app-release">
            <AdminRoute><AppReleasePage /></AdminRoute>
          </Route>
          <Route path="/customers">
            <ProtectedRoute><CDMPage /></ProtectedRoute>
          </Route>
        </Switch>
      </QueryClientProvider>
    </AuthProvider>
    </GlobalNavProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppRoutes />
    </WouterRouter>
  );
}

export default App;
