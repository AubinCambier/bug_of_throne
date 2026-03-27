import assert from "node:assert/strict";
import { FireballManager } from "../src/server/FireballManager";

const manager = new FireballManager();

const result = manager.updateProjectiles(
	{ x: 100, y: 200, width: 50, height: 50, speedX: 0, speedY: 0 },
	{ width: 800, height: 600 }
);

assert.strictEqual(result.length, 1);

console.log("Test création fireball OK");