import { io } from 'socket.io-client';
import { hasSession } from '../utils/session.ts';
import { showView } from '../utils/viewManager.ts';
import { mountHomeView } from './homeView.ts';
import { mountLoginView } from './loginView.ts';

interface LeaderboardEntry {
	username: string;
	score: number;
	roomId: string;
	finishedAt: number;
}

let leaderboardSocket: ReturnType<typeof io> | null = null;

function disconnectLeaderboardSocket() {
	if (!leaderboardSocket) return;
	leaderboardSocket.disconnect();
	leaderboardSocket = null;
}

export function mountLeaderboardView() {
	if (!hasSession()) {
		disconnectLeaderboardSocket();
		showView('login-view');
		mountLoginView();
		return;
	}

	const leaderboardView = document.getElementById('leaderboard-view');
	if (!leaderboardView) return;

	leaderboardView.innerHTML = `
		<div class="home-container">
			<div class="home-window leaderboard-window">
				<h1 class="game-title">High-score</h1>
				<div id="leaderboard-content" class="leaderboard-content">
					<p class="rooms-empty">Chargement...</p>
				</div>
				<div class="leaderboard-actions">
					<button id="leaderboard-refresh-button">Actualiser</button>
					<button id="leaderboard-back-button">Retour</button>
				</div>
			</div>
		</div>
	`;

	const content = document.getElementById('leaderboard-content');
	const refreshButton = document.getElementById('leaderboard-refresh-button');
	const backButton = document.getElementById('leaderboard-back-button');
	let pendingRequestTimeout: number | null = null;

	const renderMessage = (message: string) => {
		if (!content) return;
		content.innerHTML = `<p class="rooms-empty">${message}</p>`;
	};

	const renderScores = (entries: LeaderboardEntry[]) => {
		if (!content) return;
		if (pendingRequestTimeout !== null) {
			clearTimeout(pendingRequestTimeout);
			pendingRequestTimeout = null;
		}

		if (entries.length === 0) {
			renderMessage('Aucun score enregistré pour le moment.');
			return;
		}

		const formatDate = new Intl.DateTimeFormat('fr-FR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});

		const rows = entries
			.map((entry, index) => (
				`<tr>
					<td>${index + 1}</td>
					<td>${entry.username}</td>
					<td>${entry.score}</td>
					<td>${formatDate.format(entry.finishedAt)}</td>
				</tr>`
			))
			.join('');

		content.innerHTML = `
			<table class="leaderboard-table">
				<thead>
					<tr>
						<th>#</th>
						<th>Pseudo</th>
						<th>Score</th>
						<th>Date</th>
					</tr>
				</thead>
				<tbody>
					${rows}
				</tbody>
			</table>
		`;
	};

	const requestScores = () => {
		if (pendingRequestTimeout !== null) {
			clearTimeout(pendingRequestTimeout);
		}
		pendingRequestTimeout = window.setTimeout(() => {
			renderMessage('Impossible de charger les scores. Clique sur Actualiser.');
		}, 4000);
		leaderboardSocket?.emit('leaderboard:list');
	};

	refreshButton?.addEventListener('click', requestScores);
	backButton?.addEventListener('click', () => {
		disconnectLeaderboardSocket();
		showView('home-view');
		mountHomeView();
	});

	disconnectLeaderboardSocket();
	const socketServerUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
	leaderboardSocket = io(socketServerUrl);

	leaderboardSocket.on('connect', requestScores);
	leaderboardSocket.on('leaderboard:top', (entries: LeaderboardEntry[]) => {
		renderScores(entries);
	});
	leaderboardSocket.on('connect_error', () => {
		if (pendingRequestTimeout !== null) {
			clearTimeout(pendingRequestTimeout);
			pendingRequestTimeout = null;
		}
		renderMessage('Connexion au serveur impossible.');
	});
}
