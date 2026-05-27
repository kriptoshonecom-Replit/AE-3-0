export default function AuthSpinner() {
  return (
    <div className="auth-spinner-wrap">
      <svg className="auth-spinner" viewBox="0 0 100 100">
        <g transform="rotate(22.5 50 50)" fill="#caa6ff">
          <circle cx="50" cy="22" r="7" />
          <circle cx="69" cy="31" r="7" />
          <circle cx="78" cy="50" r="7" />
          <circle cx="69" cy="49" r="7" />
          <circle cx="50" cy="78" r="7" />
          <circle cx="31" cy="69" r="7" />
          <circle cx="22" cy="50" r="7" />
          <circle cx="31" cy="31" r="7" />
        </g>
      </svg>
    </div>
  );
}
