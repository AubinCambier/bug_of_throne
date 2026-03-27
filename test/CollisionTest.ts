import assert from "node:assert/strict";
import { CollisionManager } from "../src/server/CollisionManager";

const manager = new CollisionManager();

const result = manager.checkCollisions(
	{ x: 100, y: 100, width: 50, height: 50, speedX: 0, speedY: 0 },
	false,
	[],
	[{ id: 1, type: 'grunt', x: 110, y: 110, width: 40, height: 40, speed: 2 }],
	[],
	[]
);

assert.strictEqual(result.playerHit, true);

console.log("Test collision joueur OK");
