export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand" href="https://www.wigan.gov.uk/" aria-label="Wigan Council home">
          <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="currentColor" />
            <path d="M7 10l3.2 12 3-8.5 2.8 8.5L19.2 10" stroke="#97be10" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx="24" cy="11" r="2.4" fill="#fec724" />
          </svg>
          <span className="brand__name">
            Wigan <strong>Council</strong>
          </span>
        </a>
        <span className="site-header__service">Jobs &amp; Skills</span>
        <span className="pill pill--proto">Prototype</span>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <p>We don’t ask for your name. Answers are deleted after 1 hour. Questions are written by AI; links go to trusted services.</p>
    </footer>
  );
}
