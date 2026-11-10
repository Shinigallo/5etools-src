import {createCompanionRecord} from "./companion-record.js";
import {abilities, labels, skills, skillLabels, mod, signed, proficiency, bonus, d20, roll, maxHp, spellSave} from "./companion-rules.js";
import {migrate, classLine, eligible, newFeatures, multiclassTable, slotsFor, advance, fixedHp} from "./companion-advancement.js";
import {fillCompanionPdf} from "./companion-pdf.js";

const KEY = "dnd-companion-5etools-v1";
const app = document.querySelector("#companion-app");
const status = document.querySelector("#status");
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"})[ch]);
const button = (text, action, attrs = "") => `<button type="button" data-action="${action}" ${attrs}>${esc(text)}</button>`;
let records = [], currentId = null, mode = "normal", classes, table, spellData, corruptStorage = null;

function notice (text) { status.textContent = text; }
function valid (record) {
	const c = record?.companion;
	return record?.companionVersion === 1 && typeof c?.id === "string" && c.id && typeof c.name === "string"
		&& Array.isArray(c.classes) && c.classes.length && c.classes.every(k => typeof k.name === "string" && Number.isInteger(k.level) && k.level >= 1)
		&& c.classes.reduce((n, k) => n + k.level, 0) === c.level && c.level >= 1 && c.level <= 20
		&& abilities.every(ab => Number.isInteger(c.scores?.[ab]) && c.scores[ab] >= 1 && c.scores[ab] <= 30)
		&& Number.isInteger(c.hpBase) && c.hpBase >= 1 && Number.isInteger(c.hp) && c.hp >= 0 && (c.hp <= maxHp(c) || c.legacyHpOverMax === true)
		&& Number.isInteger(c.tempHp) && c.tempHp >= 0
		&& Array.isArray(c.trained) && c.trained.every(name => typeof name === "string")
		&& Array.isArray(c.saves) && c.saves.every(ab => abilities.includes(ab)) && Array.isArray(c.spells)
		&& Array.isArray(c.log) && c.log.every(entry => typeof entry?.at === "string" && typeof entry.text === "string")
		&& typeof c.inventory === "string" && typeof c.notes === "string"
		&& Array.isArray(c.slots) && c.slots.length === 10 && c.slots.every(n => Number.isInteger(n) && n >= 0)
		&& Array.isArray(c.spent) && c.spent.length === 10 && c.spent.every((n, i) => Number.isInteger(n) && n >= 0 && n <= c.slots[i])
		&& c.pact && Number.isInteger(c.pact.total) && c.pact.total >= 0 && Number.isInteger(c.pact.spent) && c.pact.spent >= 0 && c.pact.spent <= c.pact.total
		&& Number.isInteger(c.pact.level) && c.pact.level >= 0 && c.pact.level <= 9
		&& c.spells.every(s => typeof s.name === "string" && typeof s.className === "string");
}
function store (updated) {
	localStorage.setItem(KEY, JSON.stringify(updated));
	records = updated;
}
function save (record) { store(records.map(r => r.companion.id === record.companion.id ? record : r)); }
function current () { return records.find(r => r.companion.id === currentId); }
function recordLog (record, text) {
	record.companion.log ??= [];
	record.companion.log.unshift({at: new Date().toLocaleString("it-IT"), text});
	record.companion.log = record.companion.log.slice(0, 60);
	save(record); notice(text);
}
async function json (path) {
	const response = await fetch(path);
	if (!response.ok) throw Error(`Dati non disponibili: ${path}`);
	return response.json();
}
async function loadRules () {
	const index = await json("data/class/index.json");
	const files = await Promise.all(Object.values(index).map(file => json(`data/class/${file}`)));
	classes = files.flatMap(file => (file.class || []).filter(k => ["PHB", "TCE"].includes(k.source) && k.edition !== "one" && !k.isSidekick)
		.map(k => ({...k, subclasses: (file.subclass || []).filter(s => s.classSource === k.source && ["PHB", "TCE"].includes(s.source))})));
	table = multiclassTable(await json("data/book/book-phb.json"));
	if (!table) throw Error("Tabella slot multiclasse non disponibile.");
}
function render () {
	const record = current();
	if (!record) {
		app.innerHTML = `<section><h2 tabindex="-1">Your characters</h2>${records.length
			? records.map(r => `<p>${button(`${r.companion.name} · ${classLine(r.companion)}`, "open", `data-id="${esc(r.companion.id)}"`)}</p>`).join("")
			: '<p>No saved characters. Create a character in CharGen, then import its character sheet JSON.</p>'}
			<div class="row-actions"><label>Import sheet or backup (including app/ backups) <input id="import" type="file" accept=".json,application/json" ${classes ? "" : "disabled"}></label>${button("Export backup", "export", records.length ? "" : "disabled")}${corruptStorage !== null ? button("Download unreadable data", "export-raw") : ""}</div>
			<p>Characters are stored in this browser. Export backups regularly.</p></section>`;
		return;
	}
	const c = record.companion;
	app.innerHTML = `<div class="row-actions">${button("All characters", "list")}${button("Export backup", "export")}${button("Download character sheet (PDF)", "pdf")}${button("Delete character", "delete")}</div>
		<h2 tabindex="-1">${esc(c.name)} · ${esc(classLine(c))}</h2><p>${esc(c.race)} · ${esc(c.background)} · level ${c.level} · proficiency ${signed(proficiency(c.level))}</p>
		<div class="grid"><section><h3>Abilities and rolls</h3>${abilities.map(ab => `<p><label>${labels[ab]} <input type="number" min="1" max="30" data-score="${ab}" value="${c.scores[ab]}"></label>${button(`Roll ${labels[ab]} (${signed(mod(c.scores[ab]))})`, "ability", `data-ab="${ab}"`)} <label>Save proficiency <input type="checkbox" data-save="${ab}" ${c.saves.includes(ab) ? "checked" : ""}></label>${button(`${labels[ab]} save ${signed(bonus(c.scores[ab], c.saves.includes(ab), c.level))}`, "save-roll", `data-ab="${ab}"`)}</p>`).join("")}
		<fieldset><legend>d20 mode</legend>${["normal", "advantage", "disadvantage"].map((value, i) => `<label><input type="radio" name="mode" value="${value}" ${mode === value ? "checked" : ""}>${["Normal", "Advantage", "Disadvantage"][i]}</label>`).join("")}</fieldset></section>
		<section><h3>Combat</h3><label>AC <input id="ac" type="number" min="0" max="99" value="${esc(c.ac)}"></label><label>Speed (ft) <input id="speed" type="number" min="0" max="999" value="${esc(c.speed)}"></label><p>HP ${esc(c.hp)}/${maxHp(c)} · temporary ${esc(c.tempHp)}</p><label>Amount <input id="hp-amount" type="number" min="1" max="9999" value="1"></label>${button("Damage", "damage")} ${button("Heal", "heal")} ${button("Temporary HP", "temp")}
		<p>${button("Short rest", "short-rest")} ${button("Long rest", "long-rest")}</p>
		<label>Attack bonus <input id="attack-bonus" type="number" value="${proficiency(c.level) + mod(c.scores.str)}"></label>${button("Roll attack", "attack")}
		<label>Damage formula <input id="damage-formula" value="1d8${signed(mod(c.scores.str))}"></label>${button("Roll damage", "damage-roll")}</section></div>
		<section><h3>Skills</h3><div class="grid">${Object.entries(skills).map(([name, ab]) => `<label><input type="checkbox" data-skill="${esc(name)}" ${c.trained.includes(name) ? "checked" : ""}>${esc(skillLabels[name])}</label>${button(signed(bonus(c.scores[ab], c.trained.includes(name), c.level)), "skill", `data-name="${esc(name)}"`)}`).join("")}</div></section>
		<section><h3>Spells</h3><p>${c.classes.filter(k => classes.find(cls => cls.name === k.name)?.spellcastingAbility).map(k => { const ab = classes.find(cls => cls.name === k.name).spellcastingAbility; return `${esc(k.name)}: save DC ${spellSave(c, ab)} · attack ${signed(proficiency(c.level) + mod(c.scores[ab]))}`; }).join(" / ") || "No spellcasting class"}</p>
		<p>Slots: ${c.slots.slice(1).map((n, i) => `${i + 1}: ${n - c.spent[i + 1]}/${n}`).join(" · ")}</p><p>Pact: ${c.pact.total - c.pact.spent}/${c.pact.total} (level ${esc(c.pact.level)}) · Concentration: ${esc(c.concentration || "none")}</p>
		${c.hp > maxHp(c) ? "<p>Inherited HP exceeds the current maximum; check it before editing.</p>" : ""}
		${c.concentration ? button("End concentration", "concentration") : ""}
		${c.spells.map(s => `<p>${esc(s.name)} (${esc(s.className)}) ${button("Cast", "cast", `data-spell="${esc(s.name)}" data-owner="${esc(s.className)}"`)} ${button("Remove", "remove-spell", `data-spell="${esc(s.name)}" data-owner="${esc(s.className)}"`)}</p>`).join("") || "<p>No spells added.</p>"}
		<label>Spell <input id="spell-name" placeholder="Exact name"></label><label>Class <select id="spell-owner">${c.classes.filter(k => classes.find(cls => cls.name === k.name)?.spellcastingAbility).map(k => `<option value="${esc(k.name)}">${esc(k.name)}</option>`).join("")}</select></label>${button("Add spell", "add-spell", c.classes.some(k => classes.find(cls => cls.name === k.name)?.spellcastingAbility) ? "" : "disabled")}
		<p>Check the class rules for the number of spells known or prepared.</p></section>
		<section><h3>Inventory and notes</h3><label for="inventory">Equipment</label><textarea id="inventory" data-note="inventory">${esc(c.inventory || "")}</textarea><label for="notes">Features and notes</label><textarea id="notes" data-note="notes">${esc(c.notes || "")}</textarea></section>
		<section><h3>Advancement</h3>${button("Level up", "level", c.level >= 20 ? "disabled" : "")} ${c.previousLevel ? button("Undo last level", "undo") : ""}<div id="level-form"></div></section>
		<section><h3>Log</h3>${c.log?.length ? `<ol>${c.log.map(entry => `<li>${esc(entry.at)}: ${esc(entry.text)}</li>`).join("")}</ol>` : "<p>No activity recorded.</p>"}</section>`;
}
async function spells () {
	if (!spellData) spellData = (async () => {
		const index = await json("data/spells/index.json");
		const files = await Promise.all(["PHB", "TCE"].filter(source => index[source]).map(source => json(`data/spells/${index[source]}`)));
		return files.flatMap(file => file.spell || []);
	})();
	return spellData;
}
function renderLevelForm () {
	const c = current().companion;
	document.querySelector("#level-form").innerHTML = `<p>Class features are recorded in the log; they are not applied automatically.</p>
		<label>Class <select id="level-class">${classes.map(k => `<option value="${esc(k.name)}" ${k.name === c.classes[0].name ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</select></label>
		<div id="level-choices"></div>`;
	renderLevelChoices();
}
function renderLevelChoices () {
	const c = current().companion, klass = classes.find(k => k.name === document.querySelector("#level-class").value);
	const prior = c.classes.find(k => k.name === klass.name), level = (prior?.level || 0) + 1;
	const features = newFeatures(klass, level, prior?.subclass);
	const needsSubclass = !prior?.subclass && klass.subclasses.length && Array.from({length: level}, (_, i) => newFeatures(klass, i + 1).some(f => f.subclass)).some(Boolean);
	document.querySelector("#level-choices").innerHTML = `<p>${esc(klass.name)} ${level} · ${features.map(f => esc(f.name)).join(", ") || "no listed features"}</p>
		${needsSubclass ? `<label>Subclass <select id="level-subclass"><option value="">Choose</option>${klass.subclasses.map(s => `<option value="${esc(s.name)}">${esc(s.name)} (${esc(s.source)})</option>`).join("")}</select></label>` : ""}
		${features.some(f => f.name === "Ability Score Improvement") ? `<label>Improvement <select id="asi-mode"><option value="two">+2</option><option value="split">+1/+1</option><option value="feat">Manual feat</option></select></label>
		<label>First ability <select id="asi-first">${abilities.map(ab => `<option value="${ab}">${labels[ab]}</option>`).join("")}</select></label>
		<label>Second ability <select id="asi-second">${abilities.map(ab => `<option value="${ab}">${labels[ab]}</option>`).join("")}</select></label>` : ""}
		<label>Base HP <input id="level-hp" type="number" min="1" max="${klass.hd.faces}" value="${fixedHp(klass.hd.faces)}"></label>
		${button("Confirm level", "confirm-level", eligible(c, klass.name, classes) ? "" : "disabled")}
		${eligible(c, klass.name, classes) ? "" : "<p>Multiclass prerequisites are not met.</p>"}`;
}
async function action (target) {
	const type = target.dataset.action;
	if (type === "list") { currentId = null; render(); return; }
	if (type === "open") { currentId = target.dataset.id; render(); return; }
	if (type === "export-raw") {
		const url = URL.createObjectURL(new Blob([corruptStorage], {type: "text/plain"}));
		const link = document.createElement("a"); link.href = url; link.download = "companion-dati-non-leggibili.txt"; link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		return;
	}
	if (type === "export") {
		const blob = new Blob([JSON.stringify({fileType: "companion-backup", version: 1, records}, null, 2)], {type: "application/json"});
		const url = URL.createObjectURL(blob), link = document.createElement("a");
		link.href = url; link.download = "companion-backup.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
		return;
	}
	const record = current(), c = record?.companion;
	if (!c) return;
	if (type === "pdf") {
		if (!window.PDFLib) throw Error("PDF library unavailable.");
		const response = await fetch("scheda-personaggio.pdf");
		if (!response.ok) throw Error("PDF template unavailable.");
		const result = await fillCompanionPdf(await response.arrayBuffer(), c, classes, await spells(), window.PDFLib);
		const url = URL.createObjectURL(new Blob([result.bytes], {type: "application/pdf"}));
		const link = document.createElement("a"); link.href = url; link.download = `character-${c.name}.pdf`; link.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		notice(`PDF character sheet downloaded.${result.omittedPact ? " Multiclass pact slots must be recorded manually." : ""}${result.omittedSpells.length ? ` Spells without space or data: ${result.omittedSpells.join(", ")}.` : ""}`);
		return;
	}
	if (type === "delete") {
		if (!confirm(`Delete ${c.name}? Export a backup first.`)) return;
		store(records.filter(r => r.companion.id !== c.id)); currentId = null; render(); return;
	}
	const updated = structuredClone(record), pg = updated.companion;
	if (["ability", "save-roll", "skill", "attack"].includes(type)) {
		const ab = target.dataset.ab || skills[target.dataset.name];
		const modifier = type === "attack" ? Number(document.querySelector("#attack-bonus").value) : bonus(pg.scores[ab], type === "save-roll" ? pg.saves.includes(ab) : type === "skill" && pg.trained.includes(target.dataset.name), pg.level);
		if (!Number.isInteger(modifier)) throw Error("Invalid bonus.");
		const result = d20(modifier, mode);
		recordLog(updated, `${type === "skill" ? skillLabels[target.dataset.name] : type === "attack" ? "Attack" : labels[ab]}: ${result.dice.join("/")} ${signed(modifier)} = ${result.total}`);
	} else if (type === "damage-roll") {
		const formula = document.querySelector("#damage-formula").value;
		const match = /^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d+)?$/i.exec(formula.replaceAll(" ", ""));
		if (!match) throw Error("Invalid formula (example: 2d6+3).");
		const result = roll(Number(match[1]), Number(match[2]));
		recordLog(updated, `${formula}: ${result.dice.join(" + ")} ${signed(Number(match[3] || 0))} = ${result.total + Number(match[3] || 0)}`);
	} else if (["damage", "heal", "temp"].includes(type)) {
		const amount = Number(document.querySelector("#hp-amount").value);
		if (!Number.isInteger(amount) || amount < 1 || amount > 9999) throw Error("Enter a positive whole number.");
		if (type === "damage") { const left = Math.max(0, amount - pg.tempHp); pg.tempHp = Math.max(0, pg.tempHp - amount); pg.hp = Math.max(0, pg.hp - left); }
		if (type === "heal") pg.hp = Math.min(maxHp(pg), pg.hp + amount);
		if (type === "temp") pg.tempHp = Math.max(pg.tempHp, amount);
		recordLog(updated, `${type}: ${amount} · HP ${pg.hp}/${maxHp(pg)}`);
	} else if (type === "short-rest" || type === "long-rest") {
		if (!confirm(type === "short-rest" ? "Recover pact slots? Other resources are still manual." : "Restore HP and spell slots?")) return;
		pg.pact.spent = 0;
		if (type === "long-rest") { pg.hp = maxHp(pg); pg.spent.fill(0); }
		recordLog(updated, type === "short-rest" ? "Short rest: pact slots recovered." : "Long rest: HP and slots recovered.");
	} else if (type === "concentration") { pg.concentration = ""; recordLog(updated, "Concentration ended."); }
	else if (type === "add-spell") {
		const name = document.querySelector("#spell-name").value.trim(), owner = document.querySelector("#spell-owner").value;
		if (!owner || !(await spells()).some(s => s.name === name)) throw Error("Choose a PHB/TCE spell and a spellcasting class.");
		if (pg.spells.some(s => s.name === name && s.className === owner)) throw Error("Spell already added.");
		pg.spells.push({name, className: owner}); recordLog(updated, `Added ${name} (${owner}); check the class rules.`);
	} else if (type === "remove-spell") {
		pg.spells = pg.spells.filter(s => s.name !== target.dataset.spell || s.className !== target.dataset.owner);
		recordLog(updated, `Removed ${target.dataset.spell} (${target.dataset.owner}).`);
	}
	else if (type === "cast") {
		const spell = (await spells()).find(s => s.name === target.dataset.spell);
		if (!spell) throw Error("Spell not found in PHB/TCE data.");
		let slot = 0, usePact = false;
		if (spell.level) {
			slot = Number(prompt(`Slot level for ${spell.name} (minimum ${spell.level})`, String(spell.level)));
			if (!Number.isInteger(slot) || slot < spell.level || slot > 9) throw Error("Invalid slot level.");
			const normal = pg.slots[slot] > pg.spent[slot], pact = pg.pact.total > pg.pact.spent && pg.pact.level === slot;
			if (!normal && !pact) throw Error("No spell slot available.");
			usePact = pact && (!normal || confirm("Use a pact slot? Cancel to use a regular slot."));
		}
		if (!confirm(`Cast ${spell.name}?`)) return;
		if (slot) { if (usePact) pg.pact.spent++; else pg.spent[slot]++; }
		if (spell.duration?.some(d => d.concentration)) pg.concentration = spell.name;
		recordLog(updated, `Cast: ${spell.name}${slot ? ` · level ${slot}${usePact ? " pact slot" : " slot"}` : ""}`);
	} else if (type === "level") { renderLevelForm(); return; }
	else if (type === "confirm-level") {
		target.disabled = true;
		const klass = classes.find(k => k.name === document.querySelector("#level-class").value);
		if (!eligible(pg, klass.name, classes)) throw Error("Multiclass prerequisites are not met.");
		const prior = pg.classes.find(k => k.name === klass.name), level = (prior?.level || 0) + 1;
		const due = !prior?.subclass && klass.subclasses.length && Array.from({length: level}, (_, i) => newFeatures(klass, i + 1).some(f => f.subclass)).some(Boolean);
		const subclass = due ? document.querySelector("#level-subclass")?.value : null;
		if (due && !klass.subclasses.some(s => s.name === subclass)) throw Error("Choose a subclass.");
		const next = advance(pg, klass, Number(document.querySelector("#level-hp").value), subclass);
		const before = maxHp(next), asi = document.querySelector("#asi-mode")?.value;
		if (asi === "feat") { const feat = prompt("Feat name (check prerequisites with your DM)"); if (!feat?.trim()) throw Error("Enter a feat name."); next.notes += `\nFeat (${klass.name} ${level}): ${feat.trim()} (apply effects manually).`; }
		else if (asi) {
			const first = document.querySelector("#asi-first").value, second = document.querySelector("#asi-second").value;
			if (asi === "split" && first === second) throw Error("Choose two different abilities.");
			for (const [ab, amount] of asi === "two" ? [[first, 2]] : [[first, 1], [second, 1]]) { if (next.scores[ab] + amount > 20) throw Error("Ability score cannot exceed 20."); next.scores[ab] += amount; }
		}
		next.hp += maxHp(next) - before;
		const progression = slotsFor(next, classes, table);
		if (progression.slots.some((count, i) => count < next.spent[i]) || progression.pact.total < next.pact.spent) throw Error("Spent slots exceed the new progression.");
		next.slots = progression.slots; next.pact = {...progression.pact, spent: next.pact.spent};
		next.previousLevel = structuredClone(pg); delete next.previousLevel.previousLevel;
		updated.companion = next;
		recordLog(updated, `Level ${next.level}: ${klass.name} ${level}. ${newFeatures(klass, level, subclass || prior?.subclass).map(f => f.name).join(", ") || "No new features"}. Check the rules for manual choices.`);
	} else if (type === "undo") {
		if (!confirm("Undo the last level? Later changes will be lost.")) return;
		updated.companion = pg.previousLevel; save(updated); notice("Level restored.");
	}
	render();
}

document.addEventListener("click", async event => {
	const target = event.target.closest("[data-action]"); if (!target) return;
	try {
		await action(target);
		if (["open", "list"].includes(target.dataset.action)) app.querySelector("h2")?.focus?.();
		else if (target.isConnected === false) document.querySelector(`[data-action="${target.dataset.action === "confirm-level" ? "level" : target.dataset.action}"]`)?.focus?.();
	} catch (error) { target.disabled = false; notice(error.message); }
});
document.addEventListener("change", async event => {
	const el = event.target;
	try {
		if (el.id === "level-class") { renderLevelChoices(); return; }
		if (el.name === "mode") { mode = el.value; return; }
		if (el.id === "import" && el.files[0]) {
			const data = JSON.parse(await el.files[0].text());
			let imported;
			if (data.fileType === "scheda") {
				const klass = classes.find(k => k.name === data.sheet?.class);
				const record = createCompanionRecord(data, klass);
				migrate(record.companion);
				const progression = slotsFor(record.companion, classes, table);
				record.companion.slots = progression.slots;
				record.companion.pact = {...progression.pact, spent: 0};
				imported = [record];
			} else if (data.fileType === "companion-backup" && data.version === 1 && Array.isArray(data.records)) imported = data.records;
			else if (data.version === 1 && Array.isArray(data.characters)) imported = data.characters.map(character => {
				const pg = migrate(structuredClone(character));
				if (Number.isInteger(pg.hp) && pg.hp > maxHp(pg)) pg.legacyHpOverMax = true;
				const progression = slotsFor(pg, classes, table);
				if (pg.slotVersion !== 2 && pg.spent.every((n, i) => n <= progression.slots[i]) && pg.pact.spent <= progression.pact.total) {
					pg.slots = progression.slots; pg.pact = {...progression.pact, spent: pg.pact.spent}; pg.slotVersion = 2;
				} else if (pg.slots.some((count, i) => count !== progression.slots[i]) || pg.pact.total !== progression.pact.total) throw Error("Legacy backup slot progression could not be verified; keep the original file.");
				return {companionVersion: 1, companion: pg};
			});
			else throw Error("Unrecognized file format.");
			if (!imported.every(valid) || imported.some(r => {
				const pg = r.companion, expected = slotsFor(pg, classes, table);
				return pg.classes.some(k => !classes.some(cls => cls.name === k.name))
					|| pg.slots.some((count, i) => count !== expected.slots[i])
					|| pg.pact.total !== expected.pact.total || pg.pact.level !== expected.pact.level;
			})
				|| new Set(imported.map(r => r.companion.id)).size !== imported.length) throw Error("Invalid backup.");
			if (!confirm(`Import ${imported.length} characters? Matching IDs will be updated.${corruptStorage !== null ? " Unreadable data will be replaced; download a copy first." : ""}`)) return;
			const merged = new Map(records.map(r => [r.companion.id, r]));
			imported.forEach(r => merged.set(r.companion.id, r));
			store([...merged.values()]); corruptStorage = null; notice("Import complete."); render(); return;
		}
		const record = current(); if (!record) return;
		const updated = structuredClone(record), pg = updated.companion;
		if (el.dataset.skill) pg.trained = el.checked ? [...new Set([...pg.trained, el.dataset.skill])] : pg.trained.filter(s => s !== el.dataset.skill);
		else if (el.dataset.save) pg.saves = el.checked ? [...new Set([...pg.saves, el.dataset.save])] : pg.saves.filter(ab => ab !== el.dataset.save);
		else if (el.dataset.score) {
			const value = Number(el.value), before = maxHp(pg);
			if (!Number.isInteger(value) || value < 1 || value > 30) throw Error("Score must be between 1 and 30.");
			pg.scores[el.dataset.score] = value;
			pg.hp = Math.max(0, Math.min(maxHp(pg), pg.hp + maxHp(pg) - before));
		} else if (el.id === "ac" || el.id === "speed") {
			const value = Number(el.value);
			if (!Number.isInteger(value) || value < 0 || value > (el.id === "ac" ? 99 : 999)) throw Error("Invalid value.");
			pg[el.id] = value;
		}
		else if (el.dataset.note) pg[el.dataset.note] = el.value;
		else return;
		save(updated);
		if (!el.dataset.note) {
			render();
			const selector = el.dataset.skill ? `[data-skill="${el.dataset.skill}"]` : el.dataset.save ? `[data-save="${el.dataset.save}"]` : el.dataset.score ? `[data-score="${el.dataset.score}"]` : `#${el.id}`;
			document.querySelector(selector)?.focus?.();
		}
	} catch (error) {
		notice(el.dataset.note ? `Note not saved: ${error.message}. Copy the text before leaving.` : error.message);
		if (el.id !== "import" && !el.dataset.note) render();
	}
});

document.addEventListener("input", event => {
	const el = event.target;
	if (!el.dataset.note || !current()) return;
	try {
		const updated = structuredClone(current());
		updated.companion[el.dataset.note] = el.value;
		save(updated);
	} catch (error) { notice(`Note not saved: ${error.message}. Copy the text before leaving.`); }
});

try {
	const raw = localStorage.getItem(KEY);
	try {
		const saved = JSON.parse(raw || "[]");
		if (!Array.isArray(saved) || !saved.every(valid)) throw Error("Saved characters cannot be read.");
		records = saved;
	} catch (error) { corruptStorage = raw; notice(`${error.message} Download the original data before importing a backup.`); }
	render();
	await loadRules();
	if (corruptStorage === null) notice("Characters are saved in this browser.");
	render();
} catch (error) {
	currentId = null;
	render();
	notice(`${error.message} Import is temporarily unavailable; existing characters can still be exported.`);
}
