import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";

export default function ProfilePage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
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

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt={user.fullName || "User"} />
            ) : (
              <span>{(user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "U").toUpperCase()}</span>
            )}
          </div>
          <div className="profile-info">
            <h2>{user?.fullName || "Your Account"}</h2>
            <p>{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>

        <div className="profile-details">
          <div className="profile-field">
            <label>First name</label>
            <span>{user?.firstName || "—"}</span>
          </div>
          <div className="profile-field">
            <label>Last name</label>
            <span>{user?.lastName || "—"}</span>
          </div>
          <div className="profile-field">
            <label>Email</label>
            <span>{user?.primaryEmailAddress?.emailAddress || "—"}</span>
          </div>
          <div className="profile-field">
            <label>Member since</label>
            <span>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}</span>
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
