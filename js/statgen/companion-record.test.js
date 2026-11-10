import test from "node:test";
import assert from "node:assert/strict";
import {createCompanionRecord} from "./companion-record.js";

const klass = {name: "Wizard", proficiency: ["int", "wis"]};
const sheet = {
	state: {common_characterName: "Mira", futureChoice: {keep: true}},
	sheet: {
		name: "Mira", race: "Elf", background: "Sage", class: "Wizard", subclass: null,
		abilities: {str: {score: 8}, dex: {score: 14}, con: {score: 12}, int: {score: 16}, wis: {score: 13}, cha: {score: 10}},
		hp: 7, ac: 12, saves: {int: 5, wis: 3}, skills: ["arcana"],
		spells: {cantrips: ["Light"], level1: ["Magic Missile"]},
		futureField: {keep: true},
	},
};

test("converts a level-one sheet without losing the original JSON", () => {
	const record = createCompanionRecord(sheet, klass, "pg-1");
	assert.equal(record.companionVersion, 1);
	assert.equal(record.companion.id, "pg-1");
	assert.equal(record.companion.hpBase, 6);
	assert.deepEqual(record.companion.saves, ["int", "wis"]);
	assert.deepEqual(record.companion.trained, ["arcana"]);
	assert.deepEqual(record.companion.spells, [
		{name: "Light", className: "Wizard"}, {name: "Magic Missile", className: "Wizard"},
	]);
	const restored = JSON.parse(JSON.stringify(record));
	assert.deepEqual(restored.state, sheet.state);
	assert.deepEqual(restored.sheet, sheet.sheet);
	assert.deepEqual(restored.companion, record.companion);
});

test("rejects incomplete sheets instead of creating corrupt characters", () => {
	assert.throws(() => createCompanionRecord({...sheet, sheet: {...sheet.sheet, hp: null}}, klass, "pg-1"));
	assert.throws(() => createCompanionRecord(sheet, {name: "Fighter", proficiency: ["str", "con"]}, "pg-1"));
});
