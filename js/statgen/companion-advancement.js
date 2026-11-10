import {mod} from "./companion-rules.js";

export function migrate (character) {
	if (!Array.isArray(character.classes)) character.classes = [{name: character.className, level: character.level, subclass: null}];
	character.level = character.classes.reduce((sum, item) => sum + item.level, 0);
	character.hpBase ??= 1;
	character.spells = (character.spells || []).map(s => typeof s === "string" ? {name: s, className: character.className} : s);
	character.pact ??= {total: 0, spent: 0, level: 0};
	character.slots ??= Array(10).fill(0);
	character.spent ??= Array(10).fill(0);
	return character;
}
export const classLine = character => character.classes.map(c => `${c.name} ${c.level}${c.subclass ? ` · ${c.subclass}` : ""}`).join(" / ");
function meets (scores, requirements) {
	if (!requirements) return true;
	if (requirements.or) return requirements.or.some(r => Object.entries(r).some(([ability, minimum]) => Number(scores[ability]) >= minimum));
	return Object.entries(requirements).every(([ability, minimum]) => Number(scores[ability]) >= minimum);
}
export function eligible (character, name, catalog) {
	if (character.classes.some(c => c.name === name)) return true;
	const target = catalog.find(c => c.name === name);
	return !!target?.multiclassing && [...character.classes.map(c => catalog.find(k => k.name === c.name)), target].every(c => c && meets(character.scores, c.multiclassing?.requirements));
}
export function newFeatures (klass, level, subclass = null) {
	const base = (klass.classFeatures || []).filter(ref => {
		const raw = typeof ref === "string" ? ref : ref.classFeature;
		const parts = raw?.split("|") || [];
		return parts[1] === klass.name && (parts[2] || "PHB") === klass.source && Number(parts[3]) === level && (!parts[4] || parts[4] === klass.source)
			&& !parts[0].startsWith("Optional Rule:");
	}).map(ref => ({name: (typeof ref === "string" ? ref : ref.classFeature).split("|")[0], subclass: !!ref.gainSubclassFeature}));
	const chosen = klass.subclasses?.find(s => s.name === subclass);
	const extra = (chosen?.subclassFeatures || []).filter(ref => {
		const parts = (typeof ref === "string" ? ref : ref.subclassFeature)?.split("|") || [];
		return parts[1] === klass.name && (parts[2] || "PHB") === klass.source && parts[3] === chosen.shortName
			&& (parts[4] || "PHB") === chosen.source && Number(parts[5]) === level;
	}).map(ref => ({name: (typeof ref === "string" ? ref : ref.subclassFeature).split("|")[0], subclass: false}));
	return [...base, ...extra];
}
export function multiclassTable (book) {
	function find (node) {
		if (!node || typeof node !== "object") return;
		if (node.caption === "Multiclass Spellcaster: Spell Slots per Spell Level") return node.rows;
		for (const value of Object.values(node)) {
			const result = Array.isArray(value) ? value.map(find).find(Boolean) : find(value);
			if (result) return result;
		}
	}
	return find(book);
}
export function slotsFor (character, classes, table) {
	const byName = name => classes.find(c => c.name === name);
	const groups = entry => {
		const klass = byName(entry.name);
		return [...(klass?.classTableGroups || []), ...(klass?.subclasses?.find(s => s.name === entry.subclass)?.subclassTableGroups || [])];
	};
	const entries = character.classes.filter(c => c.name !== "Warlock").filter(c => {
		if (["Fighter", "Rogue"].includes(c.name)) return c.level >= 3 && ["Eldritch Knight", "Arcane Trickster"].includes(c.subclass);
		return groups(c).some(g => g.rowsSpellProgression);
	});
	let row;
	if (entries.length === 1) row = groups(entries[0]).find(g => g.rowsSpellProgression)?.rowsSpellProgression[entries[0].level - 1];
	if (entries.length > 1) {
		const casterLevel = entries.reduce((sum, c) => sum + (c.name === "Artificer" ? Math.ceil(c.level / 2) : ["Paladin", "Ranger"].includes(c.name) ? Math.floor(c.level / 2) : ["Fighter", "Rogue"].includes(c.name) ? Math.floor(c.level / 3) : c.level), 0);
		row = casterLevel ? table[casterLevel - 1]?.slice(1).map(v => typeof v === "number" ? v : 0) : null;
	}
	const slots = [0, ...(row || Array(9).fill(0))];
	while (slots.length < 10) slots.push(0);
	const warlock = character.classes.find(c => c.name === "Warlock");
	const group = warlock && byName("Warlock")?.classTableGroups?.find(g => g.colLabels?.includes("Spell Slots"));
	const pactRow = group?.rows?.[warlock.level - 1];
	const pactLevel = pactRow ? Number(/(\d+)(?:st|nd|rd|th)/.exec(pactRow[3])?.[1] || 0) : 0;
	return {slots, pact: {total: pactRow?.[2] || 0, level: pactLevel}};
}
export function advance (character, klass, added, subclass = null) {
	if (character.level >= 20) throw Error("Maximum level reached.");
	if (!Number.isInteger(added) || added < 1 || added > klass.hd.faces) throw Error(`Base HP: enter a number from 1 to ${klass.hd.faces}.`);
	const next = structuredClone(character);
	const before = next.hpBase + next.level * mod(next.scores.con);
	let entry = next.classes.find(c => c.name === klass.name);
	if (!entry) { entry = {name: klass.name, level: 0, subclass: null}; next.classes.push(entry); }
	entry.level++;
	if (subclass) entry.subclass = subclass;
	next.level++;
	next.hpBase += Math.max(1, added + mod(next.scores.con)) - mod(next.scores.con);
	const after = next.hpBase + next.level * mod(next.scores.con);
	next.hp += after - before;
	next.className = next.classes[0].name;
	return next;
}
export const fixedHp = die => Math.floor(die / 2) + 1;
