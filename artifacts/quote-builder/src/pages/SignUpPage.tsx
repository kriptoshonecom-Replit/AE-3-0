import { SignUp } from "@clerk/react";
import logo from "/logo.png";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="auth-page">
      <div className="auth-brand">
        <img src={logo} alt="Aloha Essential CPQ 3.0" className="auth-logo" />
        <span>Aloha Essential CPQ 3.0</span>
      </div>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        appearance={{
          layout: {
            unsafe_disableDevelopmentModeWarnings: true,
          },
          elements: {
            rootBox: "auth-clerk-root",
            card: "auth-clerk-card",
            badge: { display: "none" },
          },
        }}
      />
    </div>
  );
}
