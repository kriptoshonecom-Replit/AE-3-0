import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

export default function ProfilePage() {
  const { user, isLoaded, signOut } = useAuth();
  const [, setLocation] = useLocation();

  if (!isLoaded) {
    return (
      <div className="profile-loading">
        <div className="spinner" />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U";

  const [firstName, ...lastParts] = (user?.fullName ?? "").split(" ");
  const lastName = lastParts.join(" ");

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            <span>{initials}</span>
          </div>
          <div className="profile-info">
            <h2>{user?.fullName || "Your Account"}</h2>
            <p>{user?.email}</p>
          </div>
        </div>

        <div className="profile-details">
          <div className="profile-field">
            <label>First name</label>
            <span>{firstName || "—"}</span>
          </div>
          <div className="profile-field">
            <label>Last name</label>
            <span>{lastName || "—"}</span>
          </div>
          <div className="profile-field">
            <label>Email</label>
            <span>{user?.email || "—"}</span>
          </div>
          <div className="profile-field">
            <label>Member since</label>
            <span>
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "—"}
            </span>
          </div>
        </div>

        <div className="profile-actions">
          <button className="btn-ghost" type="button" onClick={() => setLocation("/")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Quotes
          </button>
          <button className="btn-signout" type="button" onClick={handleSignOut}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2h3v10H9M6 4.5L3 7l3 2.5M3 7h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
