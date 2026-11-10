import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {companionPdfFields, fillCompanionPdf} from "./companion-pdf.js";

const sandbox = {exports: {}, module: {exports: {}}, Uint8Array, ArrayBuffer, setTimeout};
vm.runInNewContext(readFileSync(new URL("../../lib/pdf-lib.min.js", import.meta.url), "utf8"), sandbox);
const PDFLib = sandbox.exports;
const pdfBytes = readFileSync(new URL("../../scheda-personaggio.pdf", import.meta.url));
const klass = {name: "Wizard", hd: {faces: 6}, spellcastingAbility: "int"};
const character = {
	name: "Mira", race: "Elf", background: "Sage", className: "Wizard", level: 5,
	classes: [{name: "Wizard", level: 5, subclass: null}],
	scores: {str: 8, dex: 14, con: 12, int: 16, wis: 13, cha: 10},
	trained: ["arcana", "perception"], saves: ["int", "wis"], hpBase: 25, hp: 27, tempHp: 3, ac: 12, speed: 30, inventory: "Corda", notes: "Appunti",
	slots: [0, 4, 3, 2, 0, 0, 0, 0, 0, 0], spent: [0, 1, 0, 1, 0, 0, 0, 0, 0, 0],
	spells: [{name: "Light", className: "Wizard"}, {name: "Magic Missile", className: "Wizard"}, {name: "Fireball", className: "Wizard"}],
};
const spells = [{name: "Light", level: 0}, {name: "Magic Missile", level: 1}, {name: "Fireball", level: 3}];

test("generated fields exist in the official PDF and remain editable", async () => {
	const fields = companionPdfFields(character, [klass], spells);
	assert.equal(fields.values["SlotsTotal 21"], "2");
	assert.equal(fields.values["SlotsRemaining 21"], "1");
	assert.equal(fields.values["SpellSaveDC  2"], "14");
	assert.deepEqual(fields.omittedSpells, []);
	assert.equal(fields.values["Spells 1048"], "Fireball");
	const {bytes} = await fillCompanionPdf(pdfBytes, character, [klass], spells, PDFLib);
	const form = (await PDFLib.PDFDocument.load(bytes)).getForm();
	assert.equal(form.getTextField("CharacterName").getText(), "Mira");
	assert.equal(form.getTextField("ClassLevel").getText(), "Wizard 5");
	assert.equal(form.getTextField("HPCurrent").getText(), "27");
	assert.equal(form.getTextField("Spells 1014").getText(), "Light");
	assert.equal(form.getTextField("Spells 1048").getText(), "Fireball");
	assert.equal(form.getTextField("SlotsRemaining 21").getText(), "1");
	assert.equal(form.getTextField("Speed").getText(), "30");
	assert.equal(form.getTextField("Equipment").getText(), "Corda");
	assert.equal(form.getTextField("Features and Traits").getText(), "Appunti");
});

test("martial and multiclass PDF fields preserve abilities and slots", async () => {
	const fighter = {name: "Fighter", hd: {faces: 10}};
	const martial = {...character, className: "Fighter", classes: [{name: "Fighter", level: 5}], spells: [],
		slots: Array(10).fill(0), spent: Array(10).fill(0)};
	const a = await fillCompanionPdf(pdfBytes, martial, [fighter], spells, PDFLib);
	const martialForm = (await PDFLib.PDFDocument.load(a.bytes)).getForm();
	assert.equal(martialForm.getTextField("HDTotal").getText(), "5d10");
	assert.equal(martialForm.getTextField("SlotsTotal 19").getText(), "0");
	const mixed = {...character, classes: [{name: "Wizard", level: 3}, {name: "Fighter", level: 2}]};
	const b = await fillCompanionPdf(pdfBytes, mixed, [klass, fighter], spells, PDFLib);
	const mixedForm = (await PDFLib.PDFDocument.load(b.bytes)).getForm();
	assert.equal(mixedForm.getTextField("ClassLevel").getText(), "Wizard 3 / Fighter 2");
	assert.equal(mixedForm.getTextField("HDTotal").getText(), "3d6 + 2d10");
});

test("single-class pact slots are filled and multiclass pact slots are reported", () => {
	const warlock = {...character, classes: [{name: "Warlock", level: 5}], slots: Array(10).fill(0), spent: Array(10).fill(0), pact: {total: 2, spent: 1, level: 3}};
	const only = companionPdfFields(warlock, [{name: "Warlock", hd: {faces: 8}, spellcastingAbility: "cha"}], spells);
	assert.equal(only.values["SlotsTotal 21"], "2");
	assert.equal(only.values["SlotsRemaining 21"], "1");
	assert.equal(only.omittedPact, false);
	const mixed = companionPdfFields({...warlock, classes: [...warlock.classes, {name: "Wizard", level: 1}]}, [klass], spells);
	assert.equal(mixed.omittedPact, true);
});
