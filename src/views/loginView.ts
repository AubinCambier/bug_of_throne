import { showView } from '../utils/viewManager.ts';
import { hasSession, setSessionToken } from '../utils/session.ts';
import { mountHomeView } from './homeView.ts';

export function mountLoginView() {
  const loginView = document.getElementById('login-view');
  if (!loginView) return;

  if (hasSession()) {
    showView('home-view');
    mountHomeView();
    return;
  }

  loginView.innerHTML = `
    <div class="home-container">
      <div class="home-window">
        <h1 class="game-title">Connexion</h1>
        <form id="login-form">
          <input id="username-input" class="menu-input" type="text" placeholder="Pseudo" maxlength="32" />
          <button type="submit">Se connecter</button>
        </form>
      </div>
    </div>
  `;

  const loginForm = document.getElementById('login-form') as HTMLFormElement | null;
  const usernameInput = document.getElementById('username-input') as HTMLInputElement | null;

  loginForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const username = usernameInput?.value.trim() ?? '';
    if (!username) return;

    setSessionToken(username);
    showView('home-view');
    mountHomeView();
  });
}
