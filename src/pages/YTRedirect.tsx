import { useEffect } from 'react';

function YTRedirect() {
  useEffect(() => {
    window.location.replace('https://www.youtube.com/@phil82.');
  }, []);

  return (
    <main id="main-site">
      <p>Redirecting to <a href="https://www.youtube.com/@phil82.">Phil82 on YouTube</a>...</p>
    </main>
  );
}

export default YTRedirect;
