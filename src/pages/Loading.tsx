function LoadingPage() {
  return (
    <main id="main-site" className="page">
      <h1 className="CenterTitle">Loading Icons</h1>
      <div className="loader-grid">
        <div className="loader-box">
          <div className="spinner-ring" />
          <p>Spinning Ring</p>
        </div>
        <div className="loader-box">
          <div className="loader-dots">
            <div />
            <div />
            <div />
          </div>
          <p>Bouncing Dots</p>
        </div>
        <div className="loader-box">
          <img src="/phi_character.svg" className="rotate" width="60" height="60" alt="Rotating Phi" />
          <p>Rotating Phi</p>
        </div>
      </div>
    </main>
  );
}

export default LoadingPage;
