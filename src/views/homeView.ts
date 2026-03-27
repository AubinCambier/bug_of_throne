import { showView } from '../utils/viewManager.ts';
import { mountGameView } from './gameView.ts';
import { hasSession } from '../utils/session.ts';
import { mountLoginView } from './loginView.ts';
import { mountLeaderboardView } from './leaderboardView.ts';
import { io } from 'socket.io-client';

interface LobbyRoomSummary {
	id: string;
	playerCount: number;
	createdAt: number;
}

let lobbySocket: ReturnType<typeof io> | null = null;

function disconnectLobbySocket() {
	if (!lobbySocket) return;
	lobbySocket.disconnect();
	lobbySocket = null;
}

export function mountHomeView() {
	if (!hasSession()) {
		showView('login-view');
		mountLoginView();
		return;
	}

	const socketServerUrl = `${window.location.protocol}//${window.location.hostname}:3001`;

	const homeView = document.getElementById('home-view');
	if (!homeView) return;

	const launchGame = (roomId?: string) => {
		if (!hasSession()) {
			disconnectLobbySocket();
			showView('login-view');
			mountLoginView();
			return;
		}

		disconnectLobbySocket();
		showView('game-view');
		mountGameView(roomId);
	};

	const roomsList = document.getElementById('rooms-list');
	if (!roomsList) return;

	const formatDate = new Intl.DateTimeFormat('fr-FR', {
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});

	const renderRooms = (rooms: LobbyRoomSummary[]) => {
		if (rooms.length === 0) {
			roomsList.innerHTML = `<p class="rooms-empty">Aucune partie ouverte. Créez-en une.</p>`;
			return;
		}

		roomsList.innerHTML = rooms
			.map((room) => (
				`<div class="room-row">
					<div class="room-meta">
						<strong>${room.id}</strong>
						<span>${room.playerCount} joueur(s) • ${formatDate.format(room.createdAt)}</span>
					</div>
					<button class="join-room-button" data-room-id="${room.id}">Rejoindre</button>
				</div>`
			))
			.join('');
	};

	const createRoomButton = document.getElementById('create-room-button');
	if (createRoomButton instanceof HTMLButtonElement) {
		createRoomButton.onclick = () => {
			launchGame();
		};
	}

	const refreshRoomsButton = document.getElementById('refresh-rooms-button');
	if (refreshRoomsButton instanceof HTMLButtonElement) {
		refreshRoomsButton.onclick = () => {
			lobbySocket?.emit('lobby:list');
		};
	}

	const leaderboardButton = document.getElementById('leaderboard-button');
	if (leaderboardButton instanceof HTMLButtonElement) {
		leaderboardButton.onclick = () => {
			disconnectLobbySocket();
			showView('leaderboard-view');
			mountLeaderboardView();
		};
	}

	roomsList.onclick = (event) => {
		const target = event.target as HTMLElement | null;
		const joinButton = target?.closest<HTMLButtonElement>('.join-room-button');
		if (!joinButton) return;

		const roomId = joinButton.dataset.roomId;
		if (!roomId) return;
		launchGame(roomId);
	};

	disconnectLobbySocket();
	lobbySocket = io(socketServerUrl);

	lobbySocket.on('connect', () => {
		lobbySocket?.emit('lobby:list');
	});

	lobbySocket.on('lobby:rooms', (rooms: LobbyRoomSummary[]) => {
		renderRooms(rooms);
	});

	lobbySocket.on('connect_error', () => {
		roomsList.innerHTML = `<p class="rooms-empty">Connexion serveur impossible.</p>`;
	});

	lobbySocket.on('lobby:created', (payload: { roomId?: string }) => {
		const roomId = typeof payload?.roomId === 'string' ? payload.roomId : '';
		if (!roomId) return;
		launchGame(roomId);
	});
}
