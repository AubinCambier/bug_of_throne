import './styles/main.css';
import { showView } from './utils/viewManager';
import { mountHomeView } from './views/homeView';
import { mountLoginView } from './views/loginView';
import { hasSession } from './utils/session';

if (hasSession()) {
  showView('home-view');
  mountHomeView();
} else {
  showView('login-view');
  mountLoginView();
}
