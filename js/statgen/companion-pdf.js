import {abilities, skills, mod, proficiency, bonus, maxHp, spellSave} from "./companion-rules.js";
import {classLine} from "./companion-advancement.js";

const saveFields = {str: "ST Strength", dex: "ST Dexterity", con: "ST Constitution", int: "ST Intelligence", wis: "ST Wisdom", cha: "ST Charisma"};
const skillFields = {
	acrobatics: "Acrobatics", "animal handling": "Animal", arcana: "Arcana", athletics: "Athletics",
	deception: "Deception ", history: "History ", insight: "Insight", intimidation: "Intimidation",
	investigation: "Investigation ", medicine: "Medicine", nature: "Nature", perception: "Perception ",
	performance: "Performance", persuasion: "Persuasion", religion: "Religion", "sleight of hand": "SleightofHand",
	stealth: "Stealth ", survival: "Survival",
};
const saveChecks = {str: "Check Box 11", dex: "Check Box 18", con: "Check Box 19", int: "Check Box 20", wis: "Check Box 21", cha: "Check Box 22"};
const skillChecks = Object.fromEntries(Object.keys(skillFields).map((name, ix) => [name, `Check Box ${23 + ix}`]));
const cantripRows = ["Spells 1014", "Spells 1016", "Spells 1017", "Spells 1018", "Spells 1019", "Spells 1020", "Spells 1021", "Spells 1022"];
const firstRows = ["Spells 1015", ...Array.from({length: 11}, (_, i) => `Spells ${1023 + i}`)];
const firstChecks = ["Check Box 251", "Check Box 309", ...Array.from({length: 10}, (_, i) => `Check Box ${3010 + i}`)];
const spellRows = [
	null,
	[firstRows, firstChecks],
	[["Spells 1046", ...Array.from({length: 12}, (_, i) => `Spells ${1034 + i}`)], ["Check Box 313", "Check Box 310", ...Array.from({length: 11}, (_, i) => `Check Box ${3020 + i}`)]],
	[["Spells 1048", "Spells 1047", ...Array.from({length: 11}, (_, i) => `Spells ${1049 + i}`)], ["Check Box 315", "Check Box 314", ...Array.from({length: 11}, (_, i) => `Check Box ${3031 + i}`)]],
	[["Spells 1061", "Spells 1060", ...Array.from({length: 11}, (_, i) => `Spells ${1062 + i}`)], ["Check Box 317", "Check Box 316", ...Array.from({length: 11}, (_, i) => `Check Box ${3042 + i}`)]],
	[["Spells 1074", "Spells 1073", ...Array.from({length: 7}, (_, i) => `Spells ${1075 + i}`)], ["Check Box 319", "Check Box 318", ...Array.from({length: 7}, (_, i) => `Check Box ${3053 + i}`)]],
	[["Spells 1083", "Spells 1082", ...Array.from({length: 7}, (_, i) => `Spells ${1084 + i}`)], ["Check Box 321", "Check Box 320", ...Array.from({length: 7}, (_, i) => `Check Box ${3060 + i}`)]],
	[["Spells 1092", "Spells 1091", ...Array.from({length: 7}, (_, i) => `Spells ${1093 + i}`)], ["Check Box 323", "Check Box 322", ...Array.from({length: 7}, (_, i) => `Check Box ${3067 + i}`)]],
	[["Spells 10101", "Spells 10100", ...Array.from({length: 5}, (_, i) => `Spells ${10102 + i}`)], ["Check Box 325", "Check Box 324", ...Array.from({length: 5}, (_, i) => `Check Box ${3074 + i}`)]],
	[["Spells 10108", "Spells 10107", ...Array.from({length: 5}, (_, i) => `Spells ${10109 + i}`)], ["Check Box 327", "Check Box 326", ...Array.from({length: 5}, (_, i) => `Check Box ${3079 + i}`)]],
];
const signed = n => n >= 0 ? `+${n}` : String(n);

export function companionPdfFields (character, classes, spells = []) {
	const c = character;
	const values = {"Race ": c.race, Background: c.background, ClassLevel: classLine(c),
		ProfBonus: signed(proficiency(c.level)), AC: String(c.ac), Speed: String(c.speed ?? ""), Initiative: signed(mod(c.scores.dex)),
		HPMax: String(maxHp(c)), HPCurrent: String(c.hp), HPTemp: String(c.tempHp),
		Passive: String(10 + bonus(c.scores.wis, c.trained.includes("perception"), c.level)),
		Equipment: c.inventory || "", "Features and Traits": c.notes || ""};
	const checks = [];
	abilities.forEach(ab => {
		values[ab.toUpperCase()] = String(c.scores[ab]);
		values[({dex: "DEXmod ", cha: "CHamod"})[ab] || `${ab.toUpperCase()}mod`] = signed(mod(c.scores[ab]));
		values[saveFields[ab]] = signed(bonus(c.scores[ab], c.saves.includes(ab), c.level));
		if (c.saves.includes(ab)) checks.push(saveChecks[ab]);
	});
	Object.entries(skills).forEach(([name, ab]) => {
		const id = skillFields[name], trained = c.trained.includes(name);
		values[id] = signed(bonus(c.scores[ab], trained, c.level));
		if (trained) checks.push(skillChecks[name]);
	});
	values.HDTotal = c.classes.map(entry => `${entry.level}d${classes.find(k => k.name === entry.name)?.hd?.faces || "?"}`).join(" + ");
	values.HD = values.HDTotal;
	const pactOnly = c.classes.length === 1 && c.classes[0].name === "Warlock";
	for (let level = 1; level <= 9; level++) {
		values[`SlotsTotal ${18 + level}`] = String(pactOnly && c.pact.level === level ? c.pact.total : c.slots[level]);
		// The template labels SlotsRemaining as "slots expended."
		values[`SlotsRemaining ${18 + level}`] = String(pactOnly && c.pact.level === level ? c.pact.spent : c.spent[level]);
	}
	const casters = c.classes.map(entry => classes.find(k => k.name === entry.name)).filter(k => k?.spellcastingAbility);
	if (casters.length === 1) {
		const klass = casters[0], ab = klass.spellcastingAbility;
		values["Spellcasting Class 2"] = klass.name;
		values["SpellcastingAbility 2"] = `${ab.toUpperCase()} ${signed(mod(c.scores[ab]))}`;
		values["SpellSaveDC  2"] = String(spellSave(c, ab));
		values["SpellAtkBonus 2"] = signed(proficiency(c.level) + mod(c.scores[ab]));
	}
	const known = c.spells.map(entry => ({...entry, spell: spells.find(s => s.name === entry.name)}));
	known.filter(s => s.spell?.level === 0).slice(0, cantripRows.length).forEach(({name}, i) => { values[cantripRows[i]] = name; });
	for (let level = 1; level <= 9; level++) {
		const [rows, boxes] = spellRows[level];
		known.filter(s => s.spell?.level === level).slice(0, rows.length).forEach(({name}, i) => { values[rows[i]] = name; checks.push(boxes[i]); });
	}
	const omittedSpells = known.filter(s => !s.spell || (s.spell.level === 0 ? known.filter(x => x.spell?.level === 0).indexOf(s) >= cantripRows.length : known.filter(x => x.spell?.level === s.spell.level).indexOf(s) >= spellRows[s.spell.level][0].length)).map(s => s.name);
	return {values, checks, omittedSpells, omittedPact: !pactOnly && c.pact?.total > 0};
}

export async function fillCompanionPdf (pdfBytes, character, classes, spells, PDFLib) {
	// Fastest: the default Slow parse yields via setTimeout per object batch, which Chrome background-tab timer throttling can stall for minutes
	const pdf = await PDFLib.PDFDocument.load(pdfBytes, {parseSpeed: PDFLib.ParseSpeeds.Fastest});
	const form = pdf.getForm();
	const {values, checks, omittedSpells, omittedPact} = companionPdfFields(character, classes, spells);
	form.getTextField("CharacterName").setText(character.name);
	for (const [id, value] of Object.entries(values)) form.getTextField(id).setText(value);
	for (const id of checks) form.getCheckBox(id).check();
	// Infinity: the default (50) yields via setTimeout per object batch, which Chrome background-tab timer throttling can stall for minutes
	return {bytes: await pdf.save({objectsPerTick: Infinity}), omittedSpells, omittedPact};
}
