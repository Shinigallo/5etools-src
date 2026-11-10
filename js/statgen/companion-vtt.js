import {abilities, skills, maxHp, proficiency} from "./companion-rules.js";

const skillIds = Object.fromEntries(Object.keys(skills).map((name, ix) => [name,
	["acr", "ani", "arc", "ath", "dec", "his", "ins", "itm", "inv", "med", "nat", "prc", "prf", "per", "rel", "slt", "ste", "sur"][ix],
]));
const html = text => String(text || "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[ch]);
const spellAbility = {Artificer: "int", Bard: "cha", Cleric: "wis", Druid: "wis", Paladin: "cha", Ranger: "wis", Sorcerer: "cha", Warlock: "cha", Wizard: "int", Fighter: "int", Rogue: "int"};
const progression = {Artificer: "artificer", Bard: "full", Cleric: "full", Druid: "full", Paladin: "half", Ranger: "half", Sorcerer: "full", Warlock: "pact", Wizard: "full"};

export function foundryActor (c, classes, spellCatalog = []) {
	const klass = name => classes.find(item => item.name === name);
	if (!c?.classes?.length || c.classes.some(entry => !klass(entry.name)?.hd?.faces)) throw Error("Classe non disponibile per l'export Foundry.");
	const knownSpells = c.spells.flatMap(spell => {
		const data = spellCatalog.find(item => item.name === spell.name && item.level >= 0);
		return data ? [{name: spell.name, type: "spell", system: {level: data.level, description: {value: "Solo nome: completa componenti, effetti e preparazione manualmente."}}}] : [];
	});
	return {
		name: c.name, type: "character",
		system: {
			abilities: Object.fromEntries(abilities.map(ab => [ab, {value: c.scores[ab], proficient: Number(c.saves.includes(ab))}])),
			skills: Object.fromEntries(c.trained.filter(name => skillIds[name]).map(name => [skillIds[name], {value: 1}])),
			attributes: {
				hp: {value: c.hp, max: maxHp(c), temp: c.tempHp}, ac: {override: c.ac},
				movement: {walk: c.speed || 0},
				spells: {...Object.fromEntries(c.slots.slice(1).map((total, ix) => [`spell${ix + 1}`, {value: Math.max(0, total - c.spent[ix + 1]), override: total}])),
					pact: {value: c.pact.total - c.pact.spent, override: c.pact.total}},
			},
			details: {biography: {value: `<p>Razza: ${html(c.race)}; background: ${html(c.background)}</p><p>${html(c.notes)}</p><p>${html(c.inventory)}</p>`}},
		},
		items: [
			...c.classes.flatMap(entry => [
				{name: entry.name, type: "class", system: {levels: entry.level, hd: {denomination: `d${klass(entry.name).hd.faces}`},
					spellcasting: {progression: progression[entry.name] || (["Eldritch Knight", "Arcane Trickster"].includes(entry.subclass) ? "third" : "none"), ability: spellAbility[entry.name] || ""}}},
				...(entry.subclass ? [{name: entry.subclass, type: "subclass", system: {classIdentifier: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}}] : []),
			]),
			...knownSpells,
		],
	};
}

export function roll20Text (c) {
	return [
		`${c.name} — D&D 5E 2014 (inserimento manuale Roll20)`,
		`Razza: ${c.race} | Background: ${c.background} | ${c.classes.map(k => `${k.name} ${k.level}${k.subclass ? ` (${k.subclass})` : ""}`).join(" / ")}`,
		`Caratteristiche: ${abilities.map(ab => `${ab.toUpperCase()} ${c.scores[ab]}`).join(" | ")}`,
		`Bonus competenza: +${proficiency(c.level)} | PF: ${c.hp}/${maxHp(c)} | PF temporanei: ${c.tempHp} | CA: ${c.ac} | Velocità: ${c.speed || 0} ft`,
		`Tiri salvezza competenti: ${c.saves.join(", ") || "nessuno"}`,
		`Abilità competenti: ${c.trained.join(", ") || "nessuna"}`,
		`Slot disponibili: ${c.slots.slice(1).map((total, ix) => `${ix + 1}° ${Math.max(0, total - c.spent[ix + 1])}/${total}`).join(" | ")}`,
		`Patto: ${c.pact.total - c.pact.spent}/${c.pact.total}, livello ${c.pact.level}`,
		`Incantesimi: ${c.spells.map(spell => spell.name).join(", ") || "nessuno"}`,
		`Equipaggiamento: ${c.inventory || "—"}`,
		`Note: ${c.notes || "—"}`,
	].join("\n");
}
