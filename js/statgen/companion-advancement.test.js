import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {migrate, eligible, newFeatures, multiclassTable, slotsFor, advance, fixedHp} from "./companion-advancement.js";
import {mod, proficiency, maxHp, spellSave, d20} from "./companion-rules.js";

const data = file => JSON.parse(readFileSync(new URL(`../../data/${file}`, import.meta.url)));
const classes = ["fighter", "cleric", "wizard", "warlock", "paladin", "rogue", "ranger", "artificer"].map(name => {
	const file = data(`class/class-${name}.json`);
	const cls = file.class.find(c => c.source === (name === "artificer" ? "TCE" : "PHB"));
	return {...cls, subclasses: file.subclass.filter(s => s.classSource === cls.source && s.source === cls.source)};
});
const table = multiclassTable(data("book/book-phb.json"));
const sample = (name, level, scores = {str: 13, dex: 13, con: 14, int: 13, wis: 13, cha: 13}) => migrate({
	id: "x", name: "PG", className: name, level, scores, hpBase: 10, hp: 14, trained: [], saves: [], spells: [],
});

test("basic Companion rules", () => {
	assert.equal(mod(17), 3);
	assert.equal(proficiency(5), 3);
	assert.equal(maxHp({hpBase: 10, level: 2, scores: {con: 14}}), 14);
	assert.equal(spellSave({level: 5, scores: {int: 16}}, "int"), 14);
	assert.equal(d20(3, "advantage", (() => { const values = [.05, .95]; return () => values.shift(); })()).total, 23);
});
test("migration and class prerequisites", () => {
	const c = sample("Fighter", 1, {str: 12, dex: 13, con: 14, int: 13, wis: 12, cha: 13});
	assert.equal(eligible(c, "Wizard", classes), true);
	assert.equal(eligible(c, "Cleric", classes), false);
	c.classes.push({name: "Wizard", level: 2, subclass: null});
	migrate(c);
	assert.equal(c.level, 3);
});
test("PHB and TCE features exclude optional features from other sources", () => {
	const fighter = classes.find(c => c.name === "Fighter");
	const artificer = classes.find(c => c.name === "Artificer");
	assert.ok(newFeatures(fighter, 4).some(f => f.name === "Ability Score Improvement"));
	assert.ok(!newFeatures(fighter, 4).some(f => f.name === "Martial Versatility"));
	assert.ok(newFeatures(artificer, 3).some(f => f.subclass));
	assert.ok(!newFeatures(artificer, 1).some(f => f.name === "Optional Rule: Firearm Proficiency"));
	assert.ok(newFeatures(fighter, 7, "Champion").some(f => f.name === "Remarkable Athlete"));
	assert.ok(newFeatures(artificer, 5, "Alchemist").some(f => f.name === "Alchemical Savant"));
});
test("PHB/TCE spell slots and Pact Magic", () => {
	const wizard = sample("Wizard", 3);
	assert.deepEqual(slotsFor(wizard, classes, table).slots.slice(1, 4), [4, 2, 0]);
	wizard.classes.push({name: "Cleric", level: 2, subclass: null}); migrate(wizard);
	assert.deepEqual(slotsFor(wizard, classes, table).slots.slice(1, 4), [4, 3, 2]);
	const artificer = sample("Artificer", 1);
	artificer.classes.push({name: "Wizard", level: 1, subclass: null}); migrate(artificer);
	assert.deepEqual(slotsFor(artificer, classes, table).slots.slice(1, 4), [3, 0, 0]);
	const ek = sample("Fighter", 3); ek.classes[0].subclass = "Eldritch Knight";
	assert.deepEqual(slotsFor(ek, classes, table).slots.slice(1, 4), [2, 0, 0]);
	const pact = sample("Warlock", 2);
	pact.classes.push({name: "Wizard", level: 1, subclass: null}); migrate(pact);
	assert.deepEqual(slotsFor(pact, classes, table).pact, {total: 2, level: 1});
});
test("advancement preserves the starting character and minimum HP", () => {
	const c = sample("Fighter", 1, {str: 13, dex: 13, con: 3, int: 13, wis: 13, cha: 13});
	c.hpBase = 13; c.hp = 9;
	const next = advance(c, classes.find(k => k.name === "Wizard"), 1);
	assert.equal(c.level, 1);
	assert.equal(next.level, 2);
	assert.equal(next.hp, 10);
	assert.equal(fixedHp(8), 5);
});
