import { startGame } from '../game/Game';

export function mountGameView(roomId?: string) {
	startGame({ roomId });
}
