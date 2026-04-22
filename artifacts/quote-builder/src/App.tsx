import { Switch, Route, Redirect } from "wouter";
import { Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import QuoteBuilder from "@/pages/QuoteBuilder";
import SignInPage from "@/pages/SignInPage";
import SignUpPage from "@/pages/SignUpPage";
import ProfilePage from "@/pages/ProfilePage";
import UsersPage from "@/pages/UsersPage";
import ProductsConfigPage from "@/pages/ProductsConfigPage";
import PitConfigPage from "@/pages/PitConfigPage";
import MediaFilesPage from "@/pages/MediaFilesPage";

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

function AppRoutes() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
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
        </Switch>
      </QueryClientProvider>
    </AuthProvider>
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
