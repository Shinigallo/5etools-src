const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];

export function createCompanionRecord (exported, klass, id = crypto.randomUUID()) {
	const sheet = exported?.sheet;
	const scores = Object.fromEntries(ABILITIES.map(ab => [ab, sheet?.abilities?.[ab]?.score]));
	if (typeof id !== "string" || !id || typeof sheet?.name !== "string" || !sheet.name.trim()
		|| typeof sheet.race !== "string" || !sheet.race || typeof sheet.background !== "string" || !sheet.background
		|| typeof sheet.class !== "string" || sheet.class !== klass?.name || !Array.isArray(klass.proficiency)
		|| ABILITIES.some(ab => !Number.isInteger(scores[ab]) || scores[ab] < 1 || scores[ab] > 30)
		|| !Number.isInteger(sheet.hp) || sheet.hp < 1 || !Number.isInteger(sheet.ac) || !Array.isArray(sheet.skills)
		|| sheet.skills.some(skill => typeof skill !== "string")
		|| !Array.isArray(sheet.spells?.cantrips) || !Array.isArray(sheet.spells?.level1)
		|| [...sheet.spells.cantrips, ...sheet.spells.level1].some(spell => typeof spell !== "string")) throw new Error("Incomplete or invalid character sheet.");

	const character = {
		id,
		name: sheet.name,
		race: sheet.race,
		background: sheet.background,
		className: sheet.class,
		classes: [{name: sheet.class, level: 1, subclass: sheet.subclass || null}],
		level: 1,
		scores,
		trained: [...sheet.skills],
		saves: [...klass.proficiency],
		hpBase: sheet.hp - Math.floor((scores.con - 10) / 2),
		hp: sheet.hp,
		tempHp: 0,
		ac: sheet.ac,
		spells: [...sheet.spells.cantrips, ...sheet.spells.level1].map(name => ({name, className: sheet.class})),
		inventory: "",
		notes: "",
		log: [],
	};
	return {...structuredClone(exported), companionVersion: 1, companion: character};
}
