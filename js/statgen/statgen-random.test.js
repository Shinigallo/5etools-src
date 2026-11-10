import test from "node:test";
import assert from "node:assert/strict";
import {advanceRandomCharacter, randomSkills} from "./statgen-random.js";

test("random skills respect each group without duplicating fixed proficiencies", () => {
	const selected = randomSkills([
		{athletics: true, choose: {from: ["arcana", "history", "insight"], count: 2}},
		{any: 2},
	], ["athletics", "arcana", "history", "insight", "stealth", "perception"], () => 0);
	assert.equal(selected.length, 4);
	assert.deepEqual(selected.slice(0, 2), ["arcana", "history"]);
	assert.equal(new Set(selected).size, selected.length);
	assert.equal(selected.includes("athletics"), false);
	assert.equal(randomSkills([{choose: {from: ["arcana"], count: 2}}], ["arcana"]), null);
});

test("levels 1–20: subclass, HP and ASIs preserve the initial snapshot", () => {
	const klass = {name: "Fighter", hd: {faces: 10}, classFeatures: Array.from({length: 20}, (_, i) => [
		...(i === 2 ? [{name: "Martial Archetype", gainSubclassFeature: true}] : []),
		...([4, 6, 8, 12, 14, 16, 19].includes(i + 1) ? [{name: "Ability Score Improvement"}] : []),
	])};
	const initial = {companion: {level: 1, className: "Fighter", classes: [{name: "Fighter", level: 1, subclass: null}],
		scores: {str: 15, dex: 14, con: 12, int: 10, wis: 10, cha: 8}, hpBase: 9, hp: 10, notes: ""}, sheet: {class: "Fighter"}};
	assert.equal(advanceRandomCharacter(structuredClone(initial), klass, 1, []).companion.level, 1);
	const generated = advanceRandomCharacter(structuredClone(initial), klass, 20, [{name: "Champion"}], () => 0);
	assert.equal(generated.companion.level, 20);
	assert.equal(generated.companion.classes[0].subclass, "Champion");
	assert.equal(generated.companion.classes[0].level, 20);
	assert.equal(generated.companion.scores.str, 19);
	assert.ok(generated.companion.hp > initial.companion.hp);
	assert.deepEqual(generated.sheet, initial.sheet);
	assert.match(generated.companion.notes, /spells above 1st level/);
	const rejected = structuredClone(initial);
	assert.throws(() => advanceRandomCharacter(rejected, klass, 3, []), /No subclass/);
	assert.deepEqual(rejected, initial);
	assert.throws(() => advanceRandomCharacter(structuredClone(initial), klass, 21, []), /level from 1 to 20/);
});

test("advancement handles flat 5etools class feature references", () => {
	const klass = {name: "Fighter", hd: {faces: 10}, classFeatures: [
		{classFeature: "Martial Archetype|Fighter|PHB|3", gainSubclassFeature: true},
		"Ability Score Improvement|Fighter|PHB|4",
	]};
	const record = {companion: {level: 1, className: "Fighter", classes: [{name: "Fighter", level: 1, subclass: null}],
		scores: {str: 15, dex: 14, con: 12, int: 10, wis: 10, cha: 8}, hpBase: 9, hp: 10, notes: ""}};
	const pg = advanceRandomCharacter(record, klass, 4, [{name: "Champion"}], () => 0).companion;
	assert.equal(pg.classes[0].subclass, "Champion");
	assert.equal(pg.scores.str, 17);
});
