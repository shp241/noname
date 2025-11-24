import { lib, game, ui, get, ai, _status } from "../../../../noname.js";
import { GameEvent, Dialog, Player } from "../../../../noname/library/element/index.js";

const originalShowCharacter = Player.prototype.showCharacter;
const originalInit = Player.prototype.init;
const originalReinit = Player.prototype.reinit;
const originalUninit = Player.prototype.uninit;
const originalAddSkill = Player.prototype.addSkill;
const originalRemoveSkill = Player.prototype.removeSkill;
const GUOZHAN_SKILL_ZONES = ["main", "vice", "role"];
const GUOZHAN_SKILL_ZONE_SET = new Set(GUOZHAN_SKILL_ZONES);
const DEFAULT_GUOZHAN_SKILL_ZONE = "role";

export class PlayerGuozhan extends Player {
	/**
	 * @type {string}
	 */
	trueIdentity;

	/**
	 * @type {{ prompt: string; choices: string[] } | undefined}
	 */
	pendingTrueIdentity;

	/**
	 * @type {{ main: Set<string>; vice: Set<string>; role: Set<string> } | undefined}
	 */
	_guozhanSkillZones;

	/**
	 * @type {Map<string, "main" | "vice" | "role"> | undefined}
	 */
	_guozhanSkillZoneIndex;

	/**
	 * @type {"main" | "vice" | "role" | undefined}
	 */
	_guozhanPendingZone;

	/**
	 * 初始化或返回当前的国战技能分区结构
	 *
	 * @returns {{ main: Set<string>; vice: Set<string>; role: Set<string> }}
	 */
	ensureGuozhanSkillZones() {
		if (!this._guozhanSkillZones) {
			this._guozhanSkillZones = {
				main: new Set(),
				vice: new Set(),
				role: new Set(),
			};
			this._guozhanSkillZoneIndex = new Map();
		}
		return this._guozhanSkillZones;
	}

	/**
	 * 清空当前已有的国战技能分区数据
	 */
	resetGuozhanSkillZones() {
		const zones = this.ensureGuozhanSkillZones();
		GUOZHAN_SKILL_ZONES.forEach(zone => zones[zone].clear());
		this._guozhanSkillZoneIndex?.clear();
	}

	/**
	 * 基于当前角色与技能状态重新同步技能归属
	 */
	syncGuozhanSkillZones() {
		this.resetGuozhanSkillZones();
		const playerSkills = Array.isArray(this.skills) ? this.skills.slice() : [];
		const skillSet = new Set(playerSkills);
		const register = (name, zone) => {
			const candidates = this._getCharacterSkills(name);
			if (!candidates.length) {
				return;
			}
			candidates.forEach(skill => {
				if (skillSet.has(skill)) {
					this._assignSkillToZone(skill, zone);
				}
			});
		};
		register(this.name1, "main");
		register(this.name2, "vice");
		playerSkills.forEach(skill => {
			if (!this._guozhanSkillZoneIndex?.has(skill)) {
				this._assignSkillToZone(skill, DEFAULT_GUOZHAN_SKILL_ZONE);
			}
		});
		return this._guozhanSkillZones;
	}

	/**
	 * @param {"main" | "vice" | "role"} zone
	 * @returns {string[]}
	 */
	getGuozhanSkills(zone) {
		const zones = this.ensureGuozhanSkillZones();
		const normalized = this._normalizeGuozhanZone(zone);
		return Array.from(zones[normalized]);
	}

	/**
	 * @param {string} skill
	 * @returns {"main" | "vice" | "role" | undefined}
	 */
	getGuozhanSkillZone(skill) {
		return this._guozhanSkillZoneIndex?.get(skill);
	}

	/**
	 * @param {"main" | "vice" | "role"} zone
	 * @param {string | string[]} skills
	 * @param  {...any} args
	 */
	addSkillsToGuozhanZone(zone, skills, ...args) {
		const normalized = this._normalizeGuozhanZone(zone);
		return this._withGuozhanZone(normalized, () => this.addSkill(skills, ...args));
	}

	/**
	 * @param {"main" | "vice" | "role"} zone
	 * @param {string | string[]} skill
	 * @param {SkillTrigger | SAAType<Signal>} [expire]
	 * @param {boolean} [checkConflict]
	 */
	addTempSkillToGuozhanZone(zone, skill, expire, checkConflict) {
		let resolvedZone = zone;
		if (resolvedZone && typeof resolvedZone == "string" && !GUOZHAN_SKILL_ZONE_SET.has(resolvedZone.toLowerCase())) {
			const inferredZone = this.getGuozhanSkillZone(resolvedZone);
			if (inferredZone) {
				resolvedZone = inferredZone;
			}
		}
		const normalized = this._normalizeGuozhanZone(resolvedZone);
		return /** @type {typeof this.addTempSkill} */ (this._withGuozhanZone(normalized, () => this.addTempSkill(skill, expire, checkConflict)));
	}

	/**
	 * @param {"main" | "vice" | "role"} zone
	 * @param {string | string[]} skills
	 * @param  {...any} args
	 * @returns {string[]}
	 */
	removeSkillsFromGuozhanZone(zone, skills, ...args) {
		const normalized = this._normalizeGuozhanZone(zone);
		const list = Array.isArray(skills) ? skills : [skills];
		const targets = list.filter(skill => this.getGuozhanSkillZone(skill) === normalized);
		if (targets.length) {
			this.removeSkill(targets, ...args);
		}
		return targets;
	}

	/**
	 * @param {string} skill
	 * @param {"main" | "vice" | "role"} zone
	 */
	_assignSkillToZone(skill, zone) {
		if (typeof skill != "string") {
			return;
		}
		const normalized = this._normalizeGuozhanZone(zone);
		const zones = this.ensureGuozhanSkillZones();
		if (!this._guozhanSkillZoneIndex) {
			this._guozhanSkillZoneIndex = new Map();
		}
		GUOZHAN_SKILL_ZONES.forEach(key => zones[key].delete(skill));
		zones[normalized].add(skill);
		this._guozhanSkillZoneIndex.set(skill, normalized);
	}

	/**
	 * @param {string} skill
	 */
	_removeSkillFromZone(skill) {
		if (!this._guozhanSkillZoneIndex) {
			return;
		}
		const zone = this._guozhanSkillZoneIndex.get(skill);
		if (!zone) {
			return;
		}
		this._guozhanSkillZoneIndex.delete(skill);
		this._guozhanSkillZones?.[zone]?.delete(skill);
	}

	/**
	 * @param {"main" | "vice" | "role"} zone
	 * @param {() => any} callback
	 */
	_withGuozhanZone(zone, callback) {
		const previous = this._guozhanPendingZone;
		this._guozhanPendingZone = zone;
		try {
			return callback();
		} finally {
			this._guozhanPendingZone = previous;
		}
	}

	/**
	 * @param {string} name
	 * @returns {string[]}
	 */
	_getCharacterSkills(name) {
		if (!name) {
			return [];
		}
		const info = lib.character[name];
		if (!info) {
			return [];
		}
		if (Array.isArray(info)) {
			const block = Array.isArray(info[3]) ? info[3].slice(0) : [];
			return game.expandSkills ? game.expandSkills(block) : block;
		}
		if (Array.isArray(info.skills)) {
			return game.expandSkills ? game.expandSkills(info.skills.slice(0)) : info.skills.slice(0);
		}
		return [];
	}

	/**
	 * @param {string | undefined} zone
	 * @returns {"main" | "vice" | "role"}
	 */
	_normalizeGuozhanZone(zone) {
		if (typeof zone == "string") {
			const lowered = zone.toLowerCase();
			if (GUOZHAN_SKILL_ZONE_SET.has(lowered)) {
				return /** @type {"main" | "vice" | "role"} */ (lowered);
			}
		}
		return DEFAULT_GUOZHAN_SKILL_ZONE;
	}
	/**
	 * @param {"main" | "vice" | "role" | 0 | 1 | string} zone
	 * @returns {"main" | "vice" | "role" | undefined}
	 */
	_resolveGuozhanSwapZone(zone) {
		if (typeof zone == "number") {
			return zone === 1 ? "vice" : "main";
		}
		if (typeof zone == "string") {
			const lowered = zone.toLowerCase();
			if (lowered === "role") {
				return "role";
			}
			if (GUOZHAN_SKILL_ZONE_SET.has(lowered)) {
				return /** @type {"main" | "vice" | "role"} */ (lowered);
			}
		}
		return "main";
	}
	/**
	 * @param {"main" | "vice" | "role"} zone
	 * @returns {string | undefined}
	 */
	_getGuozhanCharacterNameByZone(zone) {
		if (zone === "main") {
			return this.name1;
		}
		if (zone === "vice") {
			return this.name2;
		}
		return;
	}
	/**
	 * @param {"main" | "vice" | "role"} zone
	 * @returns {0 | 1 | -1}
	 */
	_getGuozhanZoneIndex(zone) {
		if (zone === "main") {
			return 0;
		}
		if (zone === "vice") {
			return 1;
		}
		return -1;
	}
	/**
	 * @param {string[]} skills
	 * @returns {{ name: string; storage: any; hasMark: boolean }[]}
	 */
	_snapshotGuozhanSkillArtifacts(skills) {
		if (!Array.isArray(skills) || !skills.length) {
			return [];
		}
		return skills.map(name => ({
			name,
			storage: Object.prototype.hasOwnProperty.call(this.storage, name) ? this.storage[name] : undefined,
			hasMark: Boolean(this.marks?.[name]),
		}));
	}
	/**
	 * @param {{ name: string; storage: any; hasMark: boolean }[]} snapshots
	 */
	_applyGuozhanSkillArtifacts(snapshots) {
		if (!Array.isArray(snapshots) || !snapshots.length) {
			return;
		}
		snapshots.forEach(({ name, storage, hasMark }) => {
			if (storage !== undefined) {
				this.storage[name] = storage;
				this.syncStorage(name);
			}
			if (hasMark) {
				this.markSkill(name, true);
			}
		});
	}

	init(character, character2, skill, update) {
		const result = originalInit.call(this, character, character2, skill, update);
		this.syncGuozhanSkillZones?.();
		return result;
	}

	reinit(from, to, maxHp, online) {
		const result = originalReinit.call(this, from, to, maxHp, online);
		this.syncGuozhanSkillZones?.();
		return result;
	}

	uninit() {
		const result = originalUninit.call(this);
		this.resetGuozhanSkillZones();
		return result;
	}

	addSkill(skill, ...args) {
		if (Array.isArray(skill)) {
			return originalAddSkill.call(this, skill, ...args);
		}
		const result = originalAddSkill.call(this, skill, ...args);
		if (typeof skill == "string" && Array.isArray(this.skills) && this.skills.includes(skill)) {
			const zone = this._guozhanPendingZone;
			if (zone) {
				this._assignSkillToZone(skill, zone);
			} else if (!this.getGuozhanSkillZone(skill)) {
				this._assignSkillToZone(skill, DEFAULT_GUOZHAN_SKILL_ZONE);
			}
		}
		return result;
	}

	removeSkill(skill, ...args) {
		if (Array.isArray(skill)) {
			return originalRemoveSkill.call(this, skill, ...args);
		}
		const result = originalRemoveSkill.call(this, skill, ...args);
		if (typeof skill == "string" && (!Array.isArray(this.skills) || !this.skills.includes(skill))) {
			this._removeSkillFromZone(skill);
		}
		return result;
	}

	/**
	 * 获取玩家的势力
	 *
	 * @param {Number} [num = 0] - 根据哪张武将牌返回势力，`0`为主将，`1`为副将（默认为0）
	 * @returns {string}
	 */
	getGuozhanGroup(num = 0) {
		if (this.trueIdentity) {
			if (lib.character[this.name1][1] != "ye" || num == 1) {
				return this.trueIdentity;
			}
			return "ye";
		}
		if (get.is.double(this.name2)) {
			return lib.character[this.name1].group;
		}
		if (num == 1) {
			return lib.character[this.name2].group;
		}
		return lib.character[this.name1].group;
	}

	/**
	 * 选择军令
	 *
	 * @param {Player} target
	 * @returns
	 */
	chooseJunlingFor(target) {
		const next = game.createEvent("chooseJunlingFor");

		// @ts-expect-error 类型就是这么写的
		next.player = this;
		next.target = target;
		next.num = 2;

		// @ts-expect-error 类型就是这么写的
		next.setContent("chooseJunlingFor");

		return next;
	}

	/**
	 * 选择军令
	 *
	 * @param {Player} source
	 * @param {string} junling
	 * @param {Player[]} targets
	 */
	chooseJunlingControl(source, junling, targets) {
		const next = game.createEvent("chooseJunlingControl");
		// @ts-expect-error 类型就是这么写的
		next.player = this;
		next.source = source;
		// @ts-expect-error 类型就是这么写的
		next.junling = junling;
		if (targets.length) {
			next.targets = targets;
		}
		// @ts-expect-error 类型就是这么写的
		next.setContent("chooseJunlingControl");
		return next;
	}

	/**
	 * 执行军令
	 *
	 * @param {Player} source
	 * @param {string} junling
	 * @param {Player[]} targets
	 * @returns
	 */
	carryOutJunling(source, junling, targets) {
		const next = game.createEvent("carryOutJunling");
		next.source = source;
		// @ts-expect-error 类型就是这么写的
		next.player = this;
		if (targets.length) {
			next.targets = targets;
		}
		// @ts-expect-error 类型就是这么写的
		next.junling = junling;
		// @ts-expect-error 类型就是这么写的
		next.setContent("carryOutJunling");
		return next;
	}

	/**
	 *
	 * @param {*} [repeat]
	 * @param {*} [hidden]
	 * @returns
	 */
	mayChangeVice(repeat, hidden) {
		if (!this.playerid) {
			return;
		}
		const changedSkills = Reflect.get(_status, "changedSkills") ?? {};
		Reflect.set(_status, "changedSkills", changedSkills);
		const skill = _status.event?.name;
		if (repeat || !changedSkills[this.playerid] || !changedSkills[this.playerid].includes(skill)) {
			var next = game.createEvent("mayChangeVice");
			// @ts-expect-error 类型就是这么写的
			next.setContent("mayChangeVice");
			// @ts-expect-error 类型就是这么写的
			next.player = this;
			next.skill = skill;
			if (repeat || (!_status.connectMode && get.config("changeViceType") == "online")) {
				// @ts-expect-error 类型就是这么写的
				next.repeat = true;
			}
			if (hidden == "hidden") {
				// @ts-expect-error 类型就是这么写的
				next.hidden = true;
			}
			return next;
		}
	}

	// 后面摆了，相信后人的智慧

	differentIdentityFrom(target, self) {
		if (this == target) {
			return false;
		}
		if (this.getStorage("yexinjia_friend").includes(target)) {
			return false;
		}
		if (target.getStorage("yexinjia_friend").includes(this)) {
			return false;
		}
		if (self) {
			if (target.identity == "unknown") {
				return false;
			}
			if (target.identity == "ye" || this.identity == "ye") {
				return true;
			}
			if (this.identity == "unknown") {
				var identity = lib.character[this.name1][1];
				if (this.wontYe()) {
					return identity != target.identity;
				}
				return true;
			}
		} else {
			if (this.identity == "unknown" || target.identity == "unknown") {
				return false;
			}
			if (this.identity == "ye" || target.identity == "ye") {
				return true;
			}
		}
		return this.identity != target.identity;
	}
	sameIdentityAs(target, shown) {
		if (this.getStorage("yexinjia_friend").includes(target)) {
			return true;
		}
		if (target.getStorage("yexinjia_friend").includes(this)) {
			return true;
		}
		if (shown) {
			if (this.identity == "ye" || this.identity == "unknown") {
				return false;
			}
		} else {
			if (this == target) {
				return true;
			}
			if (target.identity == "unknown" || target.identity == "ye" || this.identity == "ye") {
				return false;
			}
			if (this.identity == "unknown") {
				var identity = lib.character[this.name1][1];
				if (this.wontYe()) {
					return identity == target.identity;
				}
				return false;
			}
		}
		return this.identity == target.identity;
	}
	getModeState() {
		return {
			unseen: this.isUnseen(0),
			unseen2: this.isUnseen(1),
		};
	}
	setModeState(info) {
		if (info.mode.unseen) {
			this.classList.add("unseen");
		}
		if (info.mode.unseen2) {
			this.classList.add("unseen2");
		}
		if (!info.name) {
			return;
		}
		// if(info.name.indexOf('unknown')==0){
		// 	if(this==game.me){
		// 		lib.translate[info.name]+='（你）';
		// 	}
		// }
		this.init(info.name1, info.name2, false);
		this.name1 = info.name1;
		this.name = info.name;
		this.node.name_seat = ui.create.div(".name.name_seat", get.verticalStr(lib.translate[this.name].slice(0, 3)), this);
		if (info.identityShown) {
			this.setIdentity(info.identity);
			this.node.identity.classList.remove("guessing");
			// @ts-expect-error 类型就是这么写的
		} else if (this != game.me) {
			// @ts-expect-error 类型就是这么写的
			this.node.identity.firstChild.innerHTML = "猜";
			this.node.identity.dataset.color = "unknown";
			this.node.identity.classList.add("guessing");
		}
	}
	dieAfter2(source) {
		var that = this;
		if (that.hasSkillTag("noDieAfter", null, source)) {
			return;
		}
		if (source && source.hasSkillTag("noDieAfter2", null, that)) {
			return;
		}
		if (source && source.shijun) {
			source.discard(source.getCards("he"));
			delete source.shijun;
		} else if (source && source.identity != "unknown") {
			if (source.identity == "ye" && !source.getStorage("yexinjia_friend").length) {
				source.draw(3);
			} else if (source.shijun2) {
				delete source.shijun2;
				source.draw(
					1 +
						game.countPlayer(function (current) {
							return current.group == that.group;
						})
				);
			} else if (that.identity == "ye") {
				if (that.getStorage("yexinjia_friend").includes(source) || source.getStorage("yexinjia_friend").includes(that)) {
					source.discard(source.getCards("he"));
				} else {
					source.draw(
						1 +
							game.countPlayer(function (current) {
								// @ts-expect-error 类型就是这么写的
								if (current == that) {
									return false;
								}
								if (current.getStorage("yexinjia_friend").includes(that)) {
									return true;
								}
								if (that.getStorage("yexinjia_friend").includes(current)) {
									return true;
								}
								return false;
							})
					);
				}
			} else if (that.identity != source.identity) {
				source.draw(game.players.filter(current => current.identity == this.identity && !current.isOut()).length + 1);
			} else {
				source.discard(source.getCards("he"));
			}
		}
	}
	dieAfter(source) {
		this.showCharacter(2);
		if (get.is.jun(this.name1)) {
			if (source && source.identity == this.identity) {
				source.shijun = true;
			} else if (source && source.identity != "ye") {
				source.shijun2 = true;
			}
			var yelist = [];
			for (var i = 0; i < game.players.length; i++) {
				if (game.players[i].identity == this.identity) {
					yelist.push(game.players[i]);
				}
			}
			// @ts-expect-error 类型就是这么写的
			game.broadcastAll(function (list) {
				for (var i = 0; i < list.length; i++) {
					list[i].identity = "ye";
					list[i].setIdentity();
				}
			}, yelist);
			// @ts-expect-error 类型就是这么写的
			_status.yeidentity.add(this.identity);
		}
		// @ts-expect-error 类型就是这么写的
		game.tryResult();
	}
	viewCharacter(target, num) {
		if (num != 0 && num != 1) {
			num = 2;
		}
		if (!target.isUnseen(num)) {
			return;
		}
		var next = game.createEvent("viewCharacter");
		// @ts-expect-error 类型就是这么写的
		next.player = this;
		next.target = target;
		next.num = num;
		next.setContent(function () {
			// @ts-expect-error 类型就是这么写的
			if (!player.storage.zhibi) {
				// @ts-expect-error 类型就是这么写的
				player.storage.zhibi = [];
			}
			// @ts-expect-error 类型就是这么写的
			player.storage.zhibi.add(target);
			var content,
				str = get.translation(target) + "的";
			// @ts-expect-error 类型就是这么写的
			if (event.num == 0 || !target.isUnseen(1)) {
				content = [str + "主将", [[target.name1], "character"]];
				// @ts-expect-error 类型就是这么写的
				game.log(player, "观看了", target, "的主将");
				// @ts-expect-error 类型就是这么写的
			} else if (event.num == 1 || !target.isUnseen(0)) {
				content = [str + "副将", [[target.name2], "character"]];
				// @ts-expect-error 类型就是这么写的
				game.log(player, "观看了", target, "的副将");
			} else {
				content = [str + "主将和副将", [[target.name1, target.name2], "character"]];
				// @ts-expect-error 类型就是这么写的
				game.log(player, "观看了", target, "的主将和副将");
			}
			// @ts-expect-error 类型就是这么写的
			player.chooseControl("ok").set("dialog", content);
		});
	}
	checkViceSkill(skill, disable) {
		if (game.expandSkills(lib.character[this.name2][3].slice(0)).includes(skill) || this.hasSkillTag("alwaysViceSkill")) {
			return true;
		} else {
			if (disable !== false) {
				this.awakenSkill(skill);
			}
			return false;
		}
	}
	checkMainSkill(skill, disable) {
		if (game.expandSkills(lib.character[this.name1][3].slice(0)).includes(skill) || this.hasSkillTag("alwaysMainSkill")) {
			return true;
		} else {
			if (disable !== false) {
				this.awakenSkill(skill);
			}
			return false;
		}
	}
	removeMaxHp(num) {
		if (game.online) {
			return;
		}
		if (!num) {
			num = 1;
		}
		while (num > 0) {
			num--;
			if (typeof this.singleHp == "boolean") {
				if (this.singleHp) {
					this.singleHp = false;
				} else {
					this.singleHp = true;
					this.maxHp--;
				}
			} else {
				this.maxHp--;
			}
		}
		this.update();
	}
	hideCharacter(num, log) {
		if (this.isUnseen(2)) {
			return;
		}
		var name = this["name" + (num + 1)];
		var next = game.createEvent("hideCharacter");
		// @ts-expect-error 类型就是这么写的
		next.player = this;
		// @ts-expect-error 类型就是这么写的
		next.toHide = name;
		next.num = num;
		// @ts-expect-error 类型就是这么写的
		next.log = log;
		// @ts-expect-error 类型就是这么写的
		next.setContent("hideCharacter");
		return next;
	}
	removeCharacter(num) {
		var name = this["name" + (num + 1)];
		var next = game.createEvent("removeCharacter");
		// @ts-expect-error 类型就是这么写的
		next.player = this;
		// @ts-expect-error 类型就是这么写的
		next.toRemove = name;
		next.num = num;
		next.setContent("removeCharacter");
		return next;
	}
	swapCharacter(target, selfSlot = 0, targetSlot = 0) {
		const resolvedTarget = target || this;
		const sourceZone = this._resolveGuozhanSwapZone(selfSlot);
		const targetZone = resolvedTarget?._resolveGuozhanSwapZone(targetSlot);
		if (!resolvedTarget || !sourceZone || !targetZone || sourceZone === "role" || targetZone === "role") {
			return;
		}
		if (this === resolvedTarget && sourceZone === targetZone) {
			return;
		}
		const next = game.createEvent("swapCharacter");
		// @ts-expect-error 类型就是这么写的
		next.player = this;
		next.target = resolvedTarget;
		next.selfZone = sourceZone;
		next.targetZone = targetZone;
		next.setContent(async function () {
			// @ts-expect-error 类型就是这么写的
			const event = _status.event;
			/** @type {PlayerGuozhan} */
			// @ts-expect-error 类型就是这么写的
			const player = event.player;
			/** @type {PlayerGuozhan} */
			const swapTarget = event.target;
			await player.$swapCharacter(swapTarget, event.selfZone, event.targetZone);
		});
		return next;
	}
	async $removeCharacter(num) {
		var name = this["name" + (num + 1)];
		var info = lib.character[name];
		if (!info) {
			return;
		}
		let tonglings = game.getTongling(this.identity);
		if (tonglings.length) {
			if (tonglings.length == 1) {
				var to = tonglings[0];
				game.log(this, "移除了" + (num ? "副将" : "主将"), "#b" + name, "，变为", "#b" + to);
				this.reinit(name, to, false);
				this.showCharacter(num, false);
				// @ts-expect-error 类型就是这么写的
				_status.characterlist.add(name);
				game.useTongling(this.identity, to);
			} else {
				let next = this.chooseButton(true, ["选择要变更的武将牌", [tonglings, "character"]]);
				next.ai = function (button) {
					return get.guozhanRank(button.link);
				};
				let result = await next.forResult();
				var to = result.links[0];
				game.log(this, "移除了" + (num ? "副将" : "主将"), "#b" + name, "，变为", "#b" + to);
				this.reinit(name, to, false);
				this.showCharacter(num, false);
				// @ts-expect-error 类型就是这么写的
				_status.characterlist.add(name);
				game.useTongling(this.identity, to);
			}
		} else {
			var to = "gz_shibing" + (info[0] == "male" ? 1 : 2) + "key";
			game.log(this, "移除了" + (num ? "副将" : "主将"), "#b" + name);
			if (!lib.character[to]) {
				lib.character[to] = [info[0], info[1], 0, [], [`character:${to.slice(3, 11)}`, "unseen"]];
				lib.translate[to] = `${get.translation(info[1])}兵`;
			}
			this.reinit(name, to, false);
			// this.showCharacter(num, false);
			// @ts-expect-error 类型就是这么写的
			_status.characterlist.add(name);
		}
	}
	async $swapCharacter(target, selfZone, targetZone) {
		const resolvedTarget = target || this;
		const normalizedSelfZone = this._resolveGuozhanSwapZone(selfZone);
		const normalizedTargetZone = resolvedTarget?._resolveGuozhanSwapZone(targetZone);
		if (!resolvedTarget || !normalizedSelfZone || !normalizedTargetZone || normalizedSelfZone === "role" || normalizedTargetZone === "role") {
			return;
		}
		if (this === resolvedTarget && normalizedSelfZone === normalizedTargetZone) {
			return;
		}
		const selfName = this._getGuozhanCharacterNameByZone(normalizedSelfZone);
		const targetName = resolvedTarget._getGuozhanCharacterNameByZone(normalizedTargetZone);
		if (!selfName || !targetName) {
			return;
		}
		const sourceSkills = this.getGuozhanSkills(normalizedSelfZone);
		const targetSkills = resolvedTarget.getGuozhanSkills(normalizedTargetZone);
		const sourceArtifacts = this._snapshotGuozhanSkillArtifacts(sourceSkills);
		const targetArtifacts = resolvedTarget._snapshotGuozhanSkillArtifacts(targetSkills);
		if (this === resolvedTarget) {
			const pairs = [this.name1, this.name2];
			const sourceIndex = this._getGuozhanZoneIndex(normalizedSelfZone);
			const targetIndex = this._getGuozhanZoneIndex(normalizedTargetZone);
			if (sourceIndex < 0 || targetIndex < 0) {
				return;
			}
			[pairs[sourceIndex], pairs[targetIndex]] = [pairs[targetIndex], pairs[sourceIndex]];
			await this.changeCharacter(pairs, false);
		} else {
			await this.reinitCharacter(selfName, targetName, false);
			await resolvedTarget.reinitCharacter(targetName, selfName, false);
		}
		this.syncGuozhanSkillZones?.();
		resolvedTarget.syncGuozhanSkillZones?.();
		this._applyGuozhanSkillArtifacts(targetArtifacts);
		resolvedTarget._applyGuozhanSkillArtifacts(sourceArtifacts);
		this.checkConflict();
		if (resolvedTarget !== this) {
			resolvedTarget.checkConflict();
		}
		const zoneText = zone => (zone === "vice" ? "副将" : "主将");
		if (resolvedTarget === this) {
			game.log(this, "交换了", "#g" + zoneText(normalizedSelfZone), "和", "#g" + zoneText(normalizedTargetZone));
		} else {
			game.log(this, "与", resolvedTarget, "交换了", "#g" + zoneText(normalizedSelfZone), "与", "#g" + zoneText(normalizedTargetZone));
		}
	}
	changeVice(hidden) {
		var next = game.createEvent("changeVice");
		// @ts-expect-error 类型就是这么写的
		next.player = this;
		// @ts-expect-error 类型就是这么写的
		next.setContent("changeVice");
		next.num = !_status.connectMode && get.config("changeViceType") == "online" ? 1 : 3;
		if (hidden) {
			// @ts-expect-error 类型就是这么写的
			next.hidden = true;
		}
		return next;
	}
	hasMainCharacter() {
		return this.name1.indexOf("gz_shibing") != 0 && !lib.character[this.name1].isShibing;
	}
	hasViceCharacter() {
		return this.name2.indexOf("gz_shibing") != 0 && !lib.character[this.name2].isShibing;
	}
	/**
	 * 判断主将或副将是否为士兵
	 *
	 * @param {0 | 1} [num=0] - 0 表示主将，1 表示副将
	 * @returns {boolean}
	 */
	isCharacterShibing(num = 0) {
		const key = "name" + (num + 1);
		const name = this[key];
		const info = name && lib.character[name];
		if (!name || !info) {
			return false;
		}
		return name.startsWith("gz_shibing") || Boolean(info.isShibing);
	}
	showCharacter(num, log) {
		if (this.pendingTrueIdentity && !this.trueIdentity && this.isUnseen(2) && this.pendingTrueIdentity.choices && this.pendingTrueIdentity.choices.length) {
			const next = game.createEvent("guozhanChooseTrueIdentity");
			// @ts-expect-error 类型就是这么写的
			next.player = this;
			next.num = num;
			next.log = log;
			next.setContent(async function () {
				// @ts-expect-error 类型就是这么写的
				const event = _status.event;
				/** @type {PlayerGuozhan} */
				// @ts-expect-error 类型就是这么写的
				const player = event.player;
				const pending = player.pendingTrueIdentity;
				if (!pending || !pending.choices || !pending.choices.length) {
					Player.prototype.showCharacter.call(player, event.num, event.log);
					return;
				}
				let choice = null;
				if (player == game.me && !_status.auto) {
					const select = player
						// @ts-expect-error 类型就是这么写的
						.chooseControl(pending.choices);
					select.set("prompt", pending.prompt || "请选择你代表的势力");
					// @ts-expect-error 类型就是这么写的
					select.set("ai", () => _status.event.controls.randomGet());
					const result = await select.forResult();
					if (result?.control) {
						choice = result.control;
					}
				}
				if (!choice) {
					// @ts-expect-error 类型就是这么写的
					const choices = pending.choices.slice();
					if (choices.length == 1) {
						choice = choices[0];
					} else {
						const preferMajority = Math.random() < 0.75;
						if (preferMajority) {
							const safeChoices = choices.filter(group => player.wontYe(group));
							const evaluationPool = safeChoices.length ? safeChoices : choices;
							let maxPopulation = -Infinity;
							/** @type {string[]} */
							let bestChoices = [];
							evaluationPool.forEach(group => {
								const population = get.population(group);
								if (population > maxPopulation) {
									maxPopulation = population;
									bestChoices = [group];
								} else if (population === maxPopulation) {
									bestChoices.push(group);
								}
							});
							if (bestChoices.length) {
								choice = bestChoices.randomGet();
							}
						}
						if (!choice) {
							choice = choices.randomGet();
						}
					}
				}
				player.trueIdentity = choice;
				player.pendingTrueIdentity = void 0;
				originalShowCharacter.call(player, event.num, event.log);
			});
			return next;
		}
		return originalShowCharacter.call(this, num, log);
	}
	$showCharacter(num, log) {
		var showYe = false;
		if (num == 0 && !this.isUnseen(0)) {
			return;
		}
		if (num == 1 && !this.isUnseen(1)) {
			return;
		}
		if (!this.isUnseen(2)) {
			return;
		}
		// @ts-expect-error 类型就是这么写的
		game.addVideo("showCharacter", this, num);
		if (this.identity == "unknown" || ((num == 0 || num == 2) && lib.character[this.name1][1] == "ye")) {
			this.group = this.getGuozhanGroup(num);
			if ((num == 0 || num == 2) && lib.character[this.name1][1] == "ye") {
				this.identity = "ye";
				if (!this._ye) {
					this._ye = true;
					showYe = true;
				}
			} else if (get.is.jun(this.name1) && this.isAlive()) {
				this.identity = this.group;
			} else if (this.wontYe(this.group)) {
				this.identity = this.group;
			} else {
				this.identity = "ye";
			}
			this.setIdentity(this.identity);
			this.ai.shown = 1;
			this.node.identity.classList.remove("guessing");

			// @ts-expect-error 类型就是这么写的
			if (_status.clickingidentity && _status.clickingidentity[0] == this) {
				// @ts-expect-error 类型就是这么写的
				for (var i = 0; i < _status.clickingidentity[1].length; i++) {
					// @ts-expect-error 类型就是这么写的
					_status.clickingidentity[1][i].delete();
					// @ts-expect-error 类型就是这么写的
					_status.clickingidentity[1][i].style.transform = "";
				}
				// @ts-expect-error 类型就是这么写的
				delete _status.clickingidentity;
			}
			// @ts-expect-error 类型就是这么写的
			game.addVideo("setIdentity", this, this.identity);
		}
		var skills;
		const mainSkillSet = new Set(this._getCharacterSkills(this.name1));
		const viceSkillSet = new Set(this._getCharacterSkills(this.name2));
		const resolveRevealZone = skill => {
			if (num == 0) {
				return "main";
			}
			if (num == 1) {
				return "vice";
			}
			if (mainSkillSet.has(skill)) {
				return "main";
			}
			if (viceSkillSet.has(skill)) {
				return "vice";
			}
			return DEFAULT_GUOZHAN_SKILL_ZONE;
		};
		switch (num) {
			case 0:
				if (log !== false) {
					game.log(this, "展示了主将", "#b" + this.name1);
				}
				this.name = this.name1;
				skills = lib.character[this.name][3];
				this.sex = lib.character[this.name][0];
				this.classList.remove("unseen");
				break;
			case 1:
				if (log !== false) {
					game.log(this, "展示了副将", "#b" + this.name2);
				}
				skills = lib.character[this.name2][3];
				if (this.sex == "unknown") {
					this.sex = lib.character[this.name2][0];
				}
				if (this.name.indexOf("unknown") == 0) {
					this.name = this.name2;
				}
				this.classList.remove("unseen2");
				break;
			case 2:
				if (log !== false) {
					game.log(this, "展示了主将", "#b" + this.name1, "、副将", "#b" + this.name2);
				}
				this.name = this.name1;
				skills = lib.character[this.name][3].concat(lib.character[this.name2][3]);
				this.sex = lib.character[this.name][0];
				this.classList.remove("unseen");
				this.classList.remove("unseen2");
				break;
		}
		game.broadcast(
			// @ts-expect-error 类型就是这么写的
			function (player, name, sex, num, identity, group) {
				player.identityShown = true;
				player.group = group;
				player.name = name;
				player.sex = sex;
				player.node.identity.classList.remove("guessing");
				switch (num) {
					case 0:
						player.classList.remove("unseen");
						break;
					case 1:
						player.classList.remove("unseen2");
						break;
					case 2:
						player.classList.remove("unseen");
						player.classList.remove("unseen2");
						break;
				}
				player.ai.shown = 1;
				player.identity = identity;
				player.setIdentity(identity);
				// @ts-expect-error 类型就是这么写的
				if (_status.clickingidentity && _status.clickingidentity[0] == player) {
					// @ts-expect-error 类型就是这么写的
					for (var i = 0; i < _status.clickingidentity[1].length; i++) {
						// @ts-expect-error 类型就是这么写的
						_status.clickingidentity[1][i].delete();
						// @ts-expect-error 类型就是这么写的
						_status.clickingidentity[1][i].style.transform = "";
					}
					// @ts-expect-error 类型就是这么写的
					delete _status.clickingidentity;
				}
			},
			this,
			this.name,
			this.sex,
			num,
			this.identity,
			this.group
		);
		this.identityShown = true;
		// @ts-expect-error 类型就是这么写的
		for (var i = 0; i < skills.length; i++) {
			if (!this.hiddenSkills.includes(skills[i])) {
				continue;
			}
			// @ts-expect-error 类型就是这么写的
			this.hiddenSkills.remove(skills[i]);
			// @ts-expect-error 类型就是这么写的
			this.addSkillsToGuozhanZone(resolveRevealZone(skills[i]), skills[i]);
		}
		this.checkConflict();
		// @ts-expect-error 类型就是这么写的
		if (!this.viceChanged) {
			var initdraw = get.config("initshow_draw");
			if (_status.connectMode) {
				initdraw = lib.configOL.initshow_draw;
			}
			// @ts-expect-error 类型就是这么写的
			if (!_status.initshown && !_status.overing && initdraw != "off" && this.isAlive() && _status.mode != "mingjiang") {
				this.popup("首亮");
				if (initdraw == "draw") {
					game.log(this, "首先明置武将，得到奖励");
					game.log(this, "摸了两张牌");
					// @ts-expect-error 类型就是这么写的
					this.draw(2).log = false;
				} else {
					this.addMark("xianqu_mark", 1);
				}
				// @ts-expect-error 类型就是这么写的
				_status.initshown = true;
			}
			if (!this.isUnseen(2) && !this._mingzhied) {
				this._mingzhied = true;
				// 处理额外的阴阳鱼（平均体力 > 4 时）
				if (this.extraYinyangyu && this.extraYinyangyu > 0) {
					for (var i = 0; i < this.extraYinyangyu; i++) {
						this.doubleDraw();
					}
				}
				// 处理 0.5 血的阴阳鱼（平均体力 <= 4 时）
				if (this.singleHp) {
					this.doubleDraw();
				}
				if (this.perfectPair()) {
					var next = game.createEvent("guozhanDraw");
					// @ts-expect-error 类型就是这么写的
					next.player = this;
					// @ts-expect-error 类型就是这么写的
					next.setContent("zhulian");
				}
			}
			if (showYe) {
				this.addMark("yexinjia_mark", 1);
			}
		}
		// @ts-expect-error 类型就是这么写的
		game.tryResult();
	}
	wontYe(group, numOfReadyToShow) {
		if (!group) {
			if (this.trueIdentity) {
				group = this.trueIdentity;
			} else {
				group = lib.character[this.name1][1];
			}
		}
		// @ts-expect-error 类型就是这么写的
		if (_status.yeidentity && _status.yeidentity.includes(group)) {
			return false;
		}
		if (get.zhu(this, null, group)) {
			return true;
		}
		if (!numOfReadyToShow) {
			numOfReadyToShow = 1;
		}
		// @ts-expect-error 类型就是这么写的
		return get.totalPopulation(group) + numOfReadyToShow <= (_status.separatism ? Math.max(get.population() / 2 - 1, 1) : get.population() / 2);
	}
	perfectPair(choosing) {
		if (_status.connectMode) {
			if (!lib.configOL.zhulian) {
				return false;
			}
		} else {
			if (!get.config("zhulian")) {
				return false;
			}
		}
		var name1 = this.name1;
		var name2 = this.name2;
		if (name1.indexOf("gz_shibing") == 0) {
			return false;
		}
		if (name2.indexOf("gz_shibing") == 0) {
			return false;
		}
		if (get.is.jun(this.name1)) {
			return true;
		}
		if (choosing && lib.character[name1][1] != "ye" && lib.character[name2][1] != "ye" && lib.character[name1][1] != lib.character[name2][1]) {
			return false;
		}
		if (name1.indexOf("gz_") == 0) {
			name1 = name1.slice(name1.indexOf("_") + 1);
		} else {
			while (name1.indexOf("_") != -1 && !lib.perfectPair[name1]) {
				name1 = name1.slice(name1.indexOf("_") + 1);
			}
		}
		if (name2.indexOf("gz_") == 0) {
			name2 = name2.slice(name2.indexOf("_") + 1);
		} else {
			while (name2.indexOf("_") != -1 && !lib.perfectPair[name2]) {
				name2 = name2.slice(name2.indexOf("_") + 1);
			}
		}
		var list = Object.keys(lib.perfectPair).concat(Object.values(lib.perfectPair)).flat();
		if (!list.includes(name1) || !list.includes(name2)) {
			return false;
		}
		return (lib.perfectPair[name1] && lib.perfectPair[name1].flat(Infinity).includes(name2)) || (lib.perfectPair[name2] && lib.perfectPair[name2].flat(Infinity).includes(name1));
	}
	siege(player) {
		if (this.identity == "unknown" || this.hasSkill("undist")) {
			return false;
		}
		if (!player) {
			var next = this.getNext();
			if (next && next.sieged()) {
				return true;
			}
			var previous = this.getPrevious();
			if (previous && previous.sieged()) {
				return true;
			}
			return false;
		} else {
			return player.sieged() && (player.getNext() == this || player.getPrevious() == this);
		}
	}
	sieged(player) {
		if (this.identity == "unknown") {
			return false;
		}
		if (player) {
			return player.siege(this);
		} else {
			var next = this.getNext();
			var previous = this.getPrevious();
			if (next && previous && next != previous) {
				if (next.identity == "unknown" || next.isFriendOf(this)) {
					return false;
				}
				return next.isFriendOf(previous);
			}
			return false;
		}
	}
	inline() {
		if (this.identity == "unknown" || this.identity == "ye" || this.hasSkill("undist")) {
			return false;
		}
		var next = this,
			previous = this;
		var list = [];
		for (var i = 0; next || previous; i++) {
			if (next) {
				// @ts-expect-error 类型就是这么写的
				next = next.getNext();
				if (!next.isFriendOf(this) || next == this) {
					// @ts-expect-error 类型就是这么写的
					next = null;
				} else {
					list.add(next);
				}
			}
			if (previous) {
				// @ts-expect-error 类型就是这么写的
				previous = previous.getPrevious();
				if (!previous.isFriendOf(this) || previous == this) {
					// @ts-expect-error 类型就是这么写的
					previous = null;
				} else {
					list.add(previous);
				}
			}
		}
		if (!list.length) {
			return false;
		}
		for (var i = 0; i < arguments.length; i++) {
			if (!list.includes(arguments[i]) && arguments[i] != this) {
				return false;
			}
		}
		return true;
	}
	logAi(targets, card) {
		if (this.ai.shown == 1 || this.isMad()) {
			return;
		}
		if (typeof targets == "number") {
			// @ts-expect-error 类型就是这么写的
			this.ai.shown += targets;
		} else {
			var effect = 0,
				c,
				shown;
			var info = get.info(card);
			if (info.ai && info.ai.expose) {
				if (_status.event.name == "_wuxie") {
					if (_status.event.source && _status.event.source.ai.shown) {
						// @ts-expect-error 类型就是这么写的
						this.ai.shown += 0.2;
					}
				} else {
					// @ts-expect-error 类型就是这么写的
					this.ai.shown += info.ai.expose;
				}
			}
			if (targets.length > 0) {
				for (var i = 0; i < targets.length; i++) {
					shown = Math.abs(targets[i].ai.shown);
					if (shown < 0.2 || targets[i].identity == "nei") {
						c = 0;
					} else if (shown < 0.4) {
						c = 0.5;
					} else if (shown < 0.6) {
						c = 0.8;
					} else {
						c = 1;
					}
					effect += get.effect(targets[i], card, this) * c;
				}
			}
			if (effect > 0) {
				if (effect < 1) {
					c = 0.5;
				} else {
					c = 1;
				}
				if (targets.length != 1 || targets[0] != this) {
					if (targets.length == 1) {
						// @ts-expect-error 类型就是这么写的
						this.ai.shown += 0.2 * c;
					} else {
						// @ts-expect-error 类型就是这么写的
						this.ai.shown += 0.1 * c;
					}
				}
			}
		}
		// @ts-expect-error 类型就是这么写的
		if (this.ai.shown > 0.95) {
			this.ai.shown = 0.95;
		}
		// @ts-expect-error 类型就是这么写的
		if (this.ai.shown < -0.5) {
			this.ai.shown = -0.5;
		}
	}
	hasShibing() {
		if (this.isCharacterShibing(0)) {
			return 1;
		}
		if (this.isCharacterShibing(1)) {
			return 2;
		}
		return 0;
	}
}
