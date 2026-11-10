export const abilities = ["str", "dex", "con", "int", "wis", "cha"];
export const labels = {str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma"};
export const skills = {
	"acrobatics": "dex", "animal handling": "wis", "arcana": "int", "athletics": "str",
	"deception": "cha", "history": "int", "insight": "wis", "intimidation": "cha",
	"investigation": "int", "medicine": "wis", "nature": "int", "perception": "wis",
	"performance": "cha", "persuasion": "cha", "religion": "int", "sleight of hand": "dex",
	"stealth": "dex", "survival": "wis",
};
export const skillLabels = Object.fromEntries(Object.keys(skills).map(name => [name, name.replace(/\b\w/g, letter => letter.toUpperCase())]));
export const mod = score => Math.floor((Number(score) - 10) / 2);
export const signed = value => value >= 0 ? `+${value}` : String(value);
export const proficiency = level => 2 + Math.floor((Number(level) - 1) / 4);
export const bonus = (score, trained, level) => mod(score) + (trained ? proficiency(level) : 0);
export const roll = (count, faces, random = Math.random) => {
	if (!Number.isInteger(count) || count < 1 || count > 100 || !Number.isInteger(faces) || faces < 2 || faces > 100) throw Error("Invalid dice");
	const dice = Array.from({length: count}, () => Math.floor(random() * faces) + 1);
	return {dice, total: dice.reduce((a, b) => a + b, 0)};
};
export function d20 (modifier = 0, mode = "normal", random = Math.random) {
	const dice = roll(mode === "normal" ? 1 : 2, 20, random).dice;
	const kept = mode === "advantage" ? Math.max(...dice) : mode === "disadvantage" ? Math.min(...dice) : dice[0];
	return {dice, kept, total: kept + Number(modifier)};
}
export const maxHp = character => Math.max(1, Number(character.hpBase || 1) + Number(character.level) * mod(character.scores.con));
export const spellSave = (character, ability) => 8 + proficiency(character.level) + mod(character.scores[ability]);
export function entriesText (node) {
	if (typeof node === "string") return node.replace(/\{@\w+ ([^}]+)\}/g, (_, inner) => inner.split("|")[2] || inner.split("|")[0]).split("|")[0];
	if (Array.isArray(node)) return node.map(entriesText).join("\n");
	if (!node || typeof node !== "object") return "";
	const head = node.name || node.caption || "";
	return [head, entriesText(node.entry), entriesText(node.entries), entriesText(node.items), entriesText(node.rows), entriesText(node.classFeatures), entriesText(node.subclassFeatures)].filter(Boolean).join("\n");
}
