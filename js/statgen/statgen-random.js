import {advance, fixedHp} from "./companion-advancement.js";
import {abilities, maxHp} from "./companion-rules.js";

export function randomSkills (groups, skillKeys, random = Math.random) {
	const fixed = new Set(groups.flatMap(group => Object.entries(group).filter(([key, value]) => key !== "choose" && key !== "any" && value).map(([key]) => key)));
	const choices = groups.flatMap(group => [
		...(group.any ? [{from: skillKeys, count: group.any}] : []),
		...(group.choose ? [{from: group.choose.from || group.choose.weighted?.from || [], count: group.choose.count ?? group.choose.amount ?? 1}] : []),
	]).sort((a, b) => a.from.length - b.from.length);
	const selected = new Set();
	for (const {from, count} of choices) {
		const pool = [...new Set(from)].filter(key => !fixed.has(key) && !selected.has(key));
		if (pool.length < count) return null;
		for (let i = 0; i < count; i++) {
			const ix = Math.floor(random() * pool.length);
			selected.add(pool.splice(ix, 1)[0]);
		}
	}
	return [...selected];
}

export function advanceRandomCharacter (record, klass, level, subclasses, random = Math.random) {
	if (!Number.isInteger(level) || level < 1 || level > 20) throw Error("Choose a level from 1 to 20.");
	let character = record.companion;
	for (let nextLevel = 2; nextLevel <= level; nextLevel++) {
		const features = (klass.classFeatures || []).flatMap((entry, ix) => Array.isArray(entry)
			? (ix === nextLevel - 1 ? entry : [])
			: (Number((typeof entry === "string" ? entry : entry.classFeature)?.split("|")[3]) === nextLevel ? [entry] : []));
		const due = features.some(feature => feature.gainSubclassFeature) && !character.classes[0].subclass;
		if (due && !subclasses.length) throw Error("No subclass available from the selected sources.");
		const subclass = due ? subclasses[Math.floor(random() * subclasses.length)].name : null;
		character = advance(character, klass, fixedHp(klass.hd.faces), subclass);
		if (features.some(feature => (feature.name || (typeof feature === "string" ? feature : feature.classFeature)?.split("|")[0]) === "Ability Score Improvement")) {
			const candidates = abilities.filter(ab => character.scores[ab] <= 18);
			if (candidates.length) {
				const before = maxHp(character);
				character.scores[candidates[Math.floor(random() * candidates.length)]] += 2;
				character.hp += maxHp(character) - before;
			}
		}
	}
	record.companion = character;
	if (level > 1) character.notes = `Generated at level ${level}: add class features, resources, and spells above 1st level manually.`;
	return record;
}
