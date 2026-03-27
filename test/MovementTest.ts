import assert from "node:assert/strict";
import { MovementManager } from "../src/server/MovementManager";

const manager = new MovementManager();

const next = manager.updatePlayer(
	{ x: 100, y: 100, width: 50, height: 50, speedX: 0, speedY: 0 },
	{ left: false, right: true, up: false, down: false },
	{ width: 800, height: 600 }
);

assert.ok(next.x > 100);

console.log("Test déplacement joueur OK");