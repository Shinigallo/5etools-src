import test from "node:test";
import assert from "node:assert/strict";
import {foundryActor, roll20Text} from "./companion-vtt.js";

test("Actor Foundry conserva livello tramite item classe e valori correnti", () => {
	const pg = {name: "A & B", race: "Human", background: "Sailor", classes: [{name: "Fighter", level: 5, subclass: "Champion"}], level: 5,
		scores: {str: 18, dex: 12, con: 14, int: 10, wis: 11, cha: 8}, saves: ["str", "con"], trained: ["perception", "persuasion", "athletics"],
		hpBase: 35, hp: 42, tempHp: 3, ac: 17, speed: 30, slots: [0, 4, 2, 0, 0, 0, 0, 0, 0, 0], spent: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
		pact: {total: 0, spent: 0, level: 0}, spells: [{name: "Shield", className: "Fighter"}], inventory: "Sword", notes: "<script>bad</script>"};
	const actor = foundryActor(pg, [{name: "Fighter", hd: {faces: 10}}], [{name: "Shield", level: 1}]);
	assert.equal(actor.type, "character");
	assert.deepEqual(actor.items.filter(item => item.type === "class").map(item => item.system.levels), [5]);
	assert.equal(actor.items.find(item => item.type === "subclass").system.classIdentifier, "fighter");
	assert.equal(actor.items.find(item => item.type === "spell").system.level, 1);
	assert.equal(actor.system.attributes.spells.spell1.value, 3);
	assert.equal(actor.system.attributes.hp.value, 42);
	assert.equal(actor.system.skills.prc.value, 1);
	assert.equal(actor.system.skills.per.value, 1);
	assert.equal(actor.system.skills.ath.value, 1);
	assert.equal(actor.system.attributes.ac.override, 17);
	assert.ok(!actor.system.details.biography.value.includes("<script>"));
	assert.match(roll20Text(pg), /Fighter 5 \(Champion\)/);
	assert.match(roll20Text(pg), /PF: 42\/45/);
	assert.throws(() => foundryActor(pg, []), /Classe non disponibile/);
});
