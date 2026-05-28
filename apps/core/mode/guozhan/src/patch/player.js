import { lib, game, ui, get, ai, _status } from "noname";

const _originalRemoveSkill = lib.element.Player.prototype.removeSkill;
const _originalAddSkill = lib.element.Player.prototype.addSkill;
const _originalInit = lib.element.Player.prototype.init;
const _originalReinit = lib.element.Player.prototype.reinit;
const _originalUninit = lib.element.Player.prototype.uninit;

export class PlayerGuozhan extends lib.element.Player {
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
	 * 获取玩家的势力
	 *
	 * @param { number } [num = 0] - 根据哪张武将牌返回势力，`0`为主将，`1`为副将（默认为0）
	 * @returns { string }
	 */
	getGuozhanGroup(num = 0) {
		if (this.trueIdentity) {
			const group = lib.character[this[num == 1 ? "name2" : "name1"]][1];
			if (num != 2 && lib.selectGroup.includes(group)) {
				return group;
			}
			if (lib.character[this.name1][1] != "ye" || num == 1) {
				return this.trueIdentity;
			}
			return "ye";
	}

	$showCharacter(num, log) {
		if (this.pendingTrueIdentity && !this.trueIdentity && this.pendingTrueIdentity.choices?.length) {
			this.trueIdentity = this.pendingTrueIdentity.choices[0];
			this.pendingTrueIdentity = void 0;
		}
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
		var mainSkills = lib.character[this.name1]?.[3] || [];
		var viceSkills = lib.character[this.name2]?.[3] || [];
		// @ts-expect-error 类型就是这么写的
		for (var i = 0; i < skills.length; i++) {
			// @ts-expect-error 类型就是这么写的
			if (!this.hiddenSkills.includes(skills[i])) {
				continue;
			}
			// @ts-expect-error 类型就是这么写的
			this.hiddenSkills.remove(skills[i]);
			var zone = mainSkills.includes(skills[i]) ? "main" : viceSkills.includes(skills[i]) ? "vice" : "role";
			this._guozhanPendingZone = zone;
			// @ts-expect-error 类型就是这么写的
			this.addSkill(skills[i]);
			this._guozhanPendingZone = void 0;
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
				if (this.extraYinyangyu && this.extraYinyangyu > 0) {
					for (var i = 0; i < this.extraYinyangyu; i++) {
						this.doubleDraw();
					}
				}
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

	/**
	 * 玩家是否“不会”变成野心家
	 *
	 * @param { string } [group] 判断所处的势力
	 * @param { number } [numOfReadyToShow] 预亮角色数，默认为1（自己）
	 * @returns { boolean }
	 */
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

	/**
	 * 判断主副将是否“珠联璧合”
	 *
	 * @param { object } [choosing] 传入已选主副将（目前无实际用处）
	 * @returns { boolean }
	 */
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
		const junFilter = (name1, name2, reverse) => {
			if (reverse !== true && junFilter(name2, name1, true)) {
				return true;
			}
			if (!get.is.jun(name1)) {
				return false;
			}
			const group = get.character(name1).group,
				info = get.character(name2);
			return info.group == group || (info.doubleGroup && info.doubleGroup.includes(group));
		};
		if (junFilter(name1, name2)) {
			return true;
		}
		if (name1.indexOf("gz_shibing") == 0) {
			return false;
		}
		if (name2.indexOf("gz_shibing") == 0) {
			return false;
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

	/**
	 * 判断玩家是否处于“围攻”状态
	 *
	 * @param { Player } [player] 参照对象，是否“围攻”该角色，不填则判断自身上下家
	 * @returns { boolean }
	 */
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
			// @ts-expect-error 类型就是这么写的
			return player.sieged() && (player.getNext() == this || player.getPrevious() == this);
		}
	}

	/**
	 * 判断玩家是否处于“被围攻”状态
	 *
	 * @param { Player } [player] 参照对象，是否被该角色“围攻”，不填则判断自身上下家
	 * @returns { boolean }
	 */
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

	/**
	 * 判断玩家是否处于“队列”
	 *
	 * @returns { boolean }
	 */
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
		if (this.isCharacterShibing(0)) return 1;
		if (this.isCharacterShibing(1)) return 2;
		return 0;
	}

	showCharacter(num, log) {
		if (this.pendingTrueIdentity && !this.trueIdentity && this.pendingTrueIdentity.choices?.length) {
			this.trueIdentity = this.pendingTrueIdentity.choices[0];
			this.pendingTrueIdentity = void 0;
		}
		const _orig = lib.element.Player.prototype.showCharacter;
		return _orig.call(this, num, log);
	}

	_requestGuozhanZone(zone) {
		if (typeof zone === "number") return zone === 1 ? "vice" : "main";
		const normalized = String(zone).toLowerCase();
		if (normalized == "vice") return "vice";
		if (normalized == "role") return "role";
		return "main";
	}

	swapCharacter(target, selfSlot = 0, targetSlot = 0) {
		const resolved = target || this;
		const srcZone = this._requestGuozhanZone(selfSlot);
		const tgtZone = resolved._requestGuozhanZone(targetSlot);
		if (!resolved || srcZone === "role" || tgtZone === "role") return;
		if (this === resolved && srcZone === tgtZone) return;
		const next = game.createEvent("swapCharacter");
		next.player = this;
		next.target = resolved;
		next.selfZone = srcZone;
		next.targetZone = tgtZone;
		next.setContent(async function () {
			const e = _status.event;
			await e.player.$swapCharacter(e.target, e.selfZone, e.targetZone);
		});
		return next;
	}

	async $swapCharacter(target, selfZone, targetZone) {
		const resolved = target || this;
		if (!resolved) return;
		const srcN = this._requestGuozhanZone(selfZone);
		const tgtN = resolved._requestGuozhanZone(targetZone);
		if (srcN === "role" || tgtN === "role") return;
		if (this === resolved && srcN === tgtN) return;
		const srcName = this["name" + (srcN === "main" ? "1" : "2")];
		const tgtName = resolved["name" + (tgtN === "main" ? "1" : "2")];
		if (!srcName || !tgtName) return;
		const srcSkills = this.getGuozhanSkills(srcN);
		const tgtSkills = resolved.getGuozhanSkills(tgtN);
		const srcSnap = srcSkills.map(n => ({
			name: n,
			storage: Object.hasOwn(this.storage, n) ? this.storage[n] : void 0,
			hasMark: Boolean(this.marks?.[n]),
		}));
		const tgtSnap = tgtSkills.map(n => ({
			name: n,
			storage: Object.hasOwn(resolved.storage, n) ? resolved.storage[n] : void 0,
			hasMark: Boolean(resolved.marks?.[n]),
		}));
		if (this === resolved) {
			const pairs = [this.name1, this.name2];
			const si = srcN === "main" ? 0 : 1;
			const ti = tgtN === "main" ? 0 : 1;
			[pairs[si], pairs[ti]] = [pairs[ti], pairs[si]];
			await this.changeCharacter(pairs, false);
		} else {
			await this.reinitCharacter(srcName, tgtName, false);
			await resolved.reinitCharacter(tgtName, srcName, false);
		}
		this.syncGuozhanSkillZones?.();
		resolved.syncGuozhanSkillZones?.();
		tgtSnap.forEach(({ name, storage, hasMark }) => {
			if (storage !== void 0) { this.storage[name] = storage; this.syncStorage(name); }
			if (hasMark) this.markSkill(name, true);
		});
		srcSnap.forEach(({ name, storage, hasMark }) => {
			if (storage !== void 0) { resolved.storage[name] = storage; resolved.syncStorage(name); }
			if (hasMark) resolved.markSkill(name, true);
		});
		this.checkConflict();
		if (resolved !== this) resolved.checkConflict();
		const zt = z => z === "vice" ? "副将" : "主将";
		if (resolved === this)
			game.log(this, "交换了", "#g" + zt(srcN), "和", "#g" + zt(tgtN));
		else
			game.log(this, "与", resolved, "交换了", "#g" + zt(srcN), "与", "#g" + zt(tgtN));
	}

	isCharacterShibing(num = 0) {
		const key = "name" + (num + 1);
		const name = this[key];
		const info = name && lib.character[name];
		if (!name || !info) return false;
		return name.startsWith("gz_shibing") || Boolean(info.isShibing);
	}

	ensureGuozhanSkillZones() {
		if (!this._guozhanSkillZones) {
			this._guozhanSkillZones = { main: new Set(), vice: new Set(), role: new Set() };
			this._guozhanSkillZoneIndex = new Map();
		}
		return this._guozhanSkillZones;
	}

	resetGuozhanSkillZones() {
		const zones = this.ensureGuozhanSkillZones();
		zones.main.clear();
		zones.vice.clear();
		zones.role.clear();
		this._guozhanSkillZoneIndex?.clear();
	}

	syncGuozhanSkillZones() {
		this.resetGuozhanSkillZones();
		const playerSkills = Array.isArray(this.skills) ? this.skills.slice() : [];
		const skillSet = new Set(playerSkills);
		const register = (name, zone) => {
			const candidates = this._getCharacterSkills(name);
			candidates.forEach(skill => {
				if (skillSet.has(skill)) this._assignSkillToZone(skill, zone);
			});
		};
		register(this.name1, "main");
		register(this.name2, "vice");
		playerSkills.forEach(skill => {
			if (!this._guozhanSkillZoneIndex?.has(skill))
				this._assignSkillToZone(skill, "role");
		});
		return this._guozhanSkillZones;
	}

	getGuozhanSkills(zone) {
		return Array.from(this.ensureGuozhanSkillZones()[zone] || []);
	}

	getGuozhanSkillZone(skill) {
		return this._guozhanSkillZoneIndex?.get(skill);
	}

	_assignSkillToZone(skill, zone) {
		if (typeof skill !== "string") return;
		const zones = this.ensureGuozhanSkillZones();
		zones.main.delete(skill);
		zones.vice.delete(skill);
		zones.role.delete(skill);
		zones[zone].add(skill);
		this._guozhanSkillZoneIndex.set(skill, zone);
	}

	_removeSkillFromZone(skill) {
		if (!this._guozhanSkillZoneIndex) return;
		const zone = this._guozhanSkillZoneIndex.get(skill);
		if (!zone) return;
		this._guozhanSkillZoneIndex.delete(skill);
		this._guozhanSkillZones?.[zone]?.delete(skill);
	}

	_getCharacterSkills(name) {
		if (!name) return [];
		const info = lib.character[name];
		if (!info) return [];
		if (Array.isArray(info)) {
			const block = Array.isArray(info[3]) ? info[3].slice(0) : [];
			return game.expandSkills ? game.expandSkills(block) : block;
		}
		if (Array.isArray(info.skills))
			return game.expandSkills ? game.expandSkills(info.skills.slice(0)) : info.skills.slice(0);
		return [];
	}

	init(character, character2, skill, update) {
		_originalInit.call(this, character, character2, skill, update);
		this.syncGuozhanSkillZones?.();
	}

	reinit(from, to, maxHp, online) {
		_originalReinit.call(this, from, to, maxHp, online);
		this.syncGuozhanSkillZones?.();
	}

	uninit() {
		_originalUninit.call(this);
		this.resetGuozhanSkillZones();
	}

	addSkill(skill, ...args) {
		if (Array.isArray(skill)) return _originalAddSkill.call(this, skill, ...args);
		const result = _originalAddSkill.call(this, skill, ...args);
		if (typeof skill === "string" && Array.isArray(this.skills) && this.skills.includes(skill)) {
			const zone = this._guozhanPendingZone || "role";
			if (!this.getGuozhanSkillZone(skill))
				this._assignSkillToZone(skill, zone);
		}
		return result;
	}

	removeSkill(skill, ...args) {
		if (Array.isArray(skill)) return _originalRemoveSkill.call(this, skill, ...args);
		const result = _originalRemoveSkill.call(this, skill, ...args);
		if (typeof skill === "string" && (!Array.isArray(this.skills) || !this.skills.includes(skill)))
			this._removeSkillFromZone(skill);
		return result;
	}
}
