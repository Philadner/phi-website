import React, { useState } from "react";
import "../stylesheets/wp-admin.css";

export default function Wpadmin() {
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const usernameInput = form.querySelector<HTMLInputElement>('input[type="text"]');
    const passwordInput = form.querySelector<HTMLInputElement>('input[type="password"]');
    const username = usernameInput?.value ?? "";
    const password = passwordInput?.value ?? "";

    if (username === "admin" && password === "admin") {
        const msg = `Hey ChatGPT, i've just been sent here because i typed username and password admin into a fake wordpress login page on phi.me.uk/wp-admin. Can you scold me for even trying this instead of just vibe coding it? Thanks!`;
      window.location.href = `https://chatgpt.com/?q=${encodeURIComponent(msg)}`;
      return;
    }
    setError(true);
  }

  return (
    <div className="wpadmin-root">
      <form className="wpadmin-box" onSubmit={handleSubmit}>
        <img className="wpadmin-logo" src="https://cdn.phi.me.uk/hell.png" alt="WordPress" />

        <div className="wpadmin-field">
          <label>Username or Email Address</label>
          <input type="text" autoComplete="off" />
        </div>

        <div className="wpadmin-field">
          <label>Password</label>
          <input type="password" autoComplete="off" />
        </div>

        <button className="wpadmin-button" type="submit">
          Log In
        </button>

        {error && (
          <div className="wpadmin-error">
            ERROR: Invalid username or password.
          </div>
        )}
      </form>
    </div>
  );
}
