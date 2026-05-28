import { lib, game, Game, ui, get, ai, _status } from "noname";
import { showYexingsContent, chooseCharacterContent, chooseCharacterOLContent } from "./content.js";

export class GameGuozhan extends Game {
	/**
	 * 不确定是干啥的，反正恒返回真
	 *
	 * @returns {boolean}
	 */
	canReplaceViewpoint() {
		return true;
	}

	/**
	 * 当野心家未明置主将，且场上只剩副将所属阵容时，野心家可明置主将，并进行”拉拢人心“
	 *
	 * 详情请参阅规则集
	 *
	 * @returns {GameEvent}
	 */
	showYexings() {
		const next = game.createEvent("showYexings", false);

		// 如果已存在展示野心的野心家，则不做处理
		// @ts-expect-error 祖宗之法就是这么写的
		if (_status.showYexings) {
			next.setContent(async () => {
				return;
			});

			return next;
		}

		// @ts-expect-error 祖宗之法就是这么写的
		_status.showYexings = true;
		next.setContent(showYexingsContent);

		return next;
	}

	/**
	 * 获取武将选择
	 *
	 * @author Spmario233
	 * @param {string[]} list - 所有武将的数组
	 * @param {number} num - 选择武将的数量
	 * @returns {string[]} - 最终武将的数组
	 */
	getCharacterChoice(list, num) {
		const choice = list.splice(0, num).sort(function (a, b) {
			return (get.is.double(a) ? 1 : -1) - (get.is.double(b) ? 1 : -1);
		});
		const map = { wei: [], shu: [], wu: [], qun: [], key: [], jin: [], ye: [] };
		for (let i = 0; i < choice.length; ++i) {
			if (get.is.double(choice[i])) {
				// @ts-expect-error 祖宗之法就是这么写的
				var group = get.is.double(choice[i], true);
				// @ts-expect-error 祖宗之法就是这么写的
				for (var ii of group) {
					if (map[ii] && map[ii].length) {
						map[ii].push(choice[i]);
						lib.character[choice[i]][1] = ii;
						group = false;
						break;
					}
				}
				if (group) {
					choice.splice(i--, 1);
				}
			} else {
				// @ts-expect-error 祖宗之法就是这么写的
				var group = lib.character[choice[i]][1];
				if (map[group]) {
					map[group].push(choice[i]);
				}
			}
		}
		if (map.ye.length) {
			for (const i in map) {
				if (i != "ye" && map[i].length) {
					return choice.randomSort();
				}
			}
			choice.remove(map.ye[0]);
			map.ye.remove(map.ye[0]);
			for (var i = 0; i < list.length; i++) {
				if (lib.character[list[i]][1] != "ye") {
					choice.push(list[i]);
					list.splice(i--, 1);
					return choice.randomSort();
				}
			}
		}
		for (const i in map) {
			if (map[i].length < 2) {
				if (map[i].length == 1) {
					choice.remove(map[i][0]);
					list.push(map[i][0]);
				}
				map[i] = false;
			}
		}
		if (choice.length == num - 1) {
			for (let i = 0; i < list.length; ++i) {
				if (map[lib.character[list[i]][1]]) {
					choice.push(list[i]);
					list.splice(i--, 1);
					break;
				}
			}
		} else if (choice.length < num - 1) {
			let group = null;
			for (let i = 0; i < list.length; ++i) {
				if (group) {
					if (lib.character[list[i]][1] == group || lib.character[list[i]][1] == "ye") {
						choice.push(list[i]);
						list.splice(i--, 1);
						if (choice.length >= num) {
							break;
						}
					}
				} else {
					if (!map[lib.character[list[i]][1]] && !get.is.double(list[i])) {
						group = lib.character[list[i]][1];
						if (group == "ye") {
							group = null;
						}
						choice.push(list[i]);
						list.splice(i--, 1);
						if (choice.length >= num) {
							break;
						}
					}
				}
			}
		}
		return choice.randomSort();
	}

	/**
	 * 联机时获取当前玩家的信息
	 *
	 * @returns {Record<string, { identity: string, shown?: number }>} - 玩家信息的对象
	 */
	getState() {
		/** @type {Record<string, { identity: string, shown?: number }>} */
		const state = {};
		for (const playerId in lib.playerOL) {
			var player = lib.playerOL[playerId];
			state[playerId] = {
				identity: player.identity,
				//group:player.group,
				shown: player.ai.shown,
			};
		}
		return state;
	}

	/**
	 * 联机时更新玩家信息
	 *
	 * @param {Record<string, { identity: string, shown?: number }>} state - 玩家信息的对象
	 */
	updateState(state) {
		for (const playerId in state) {
			const player = lib.playerOL[playerId];
			if (player) {
				player.identity = state[playerId].identity;
				//player.group=state[i].group;
				player.ai.shown = state[playerId].shown;
			}
		}
	}

	/**
	 * 联机时获取当前房间的信息
	 *
	 * @param {Dialog} uiintro
	 */
	getRoomInfo(uiintro) {
		var num, last;
		if (lib.configOL.initshow_draw == "off") {
			num = "关闭";
		} else {
			num = { mark: "标记", draw: "摸牌" }[lib.configOL.initshow_draw];
		}
		uiintro.add('<div class="text chat">群雄割据：' + (lib.configOL.separatism ? "开启" : "关闭"));
		uiintro.add('<div class="text chat">首亮奖励：' + num);
		uiintro.add('<div class="text chat">珠联璧合：' + (lib.configOL.zhulian ? "开启" : "关闭"));
		uiintro.add('<div class="text chat">出牌时限：' + lib.configOL.choose_timeout + "秒");
		uiintro.add('<div class="text chat">国战牌堆：' + (lib.configOL.guozhanpile ? "开启" : "关闭"));
		uiintro.add('<div class="text chat">鏖战模式：' + (lib.configOL.aozhan ? "开启" : "关闭"));
		last = uiintro.add('<div class="text chat">观看下家副将：' + (lib.configOL.viewnext ? "开启" : "关闭"));

		// @ts-expect-error 祖宗之法就是这么写的
		last.style.paddingBottom = "8px";
	}

	/**
	 * 为当前对局增加战绩记录
	 *
	 * @param {Boolean} bool - 当前对局是否胜利
	 */
	async addRecord(bool) {
		if (typeof bool !== "boolean") {
			return;
		}

		const data = lib.config.gameRecord.guozhan.data;

		const identity = game.me.identity;
		if (!data[identity]) {
			data[identity] = [0, 0];
		}

		if (bool) {
			++data[identity][0];
		} else {
			++data[identity][1];
		}

		/// 构建战绩记录字符串
		let group = [...lib.group, "ye"];
		// 过滤神和外服势力，以及没有战绩的势力
		group = group.filter(group => group !== "shen" && group !== "western" && data[group]);
		// 将战绩记录转换为字符串
		const strs = group.map(id => {
			const name = get.translation(`${id}2`);
			const [win, lose] = data[id];

			return `${name}: ${win}胜 ${lose}负`;
		});
		const str = strs.join("<br />");

		lib.config.gameRecord.guozhan.str = `${str}<br />`;

		await game.promises.saveConfig("gameRecord", lib.config.gameRecord);
	}

	/**
	 * 获取某名玩家可能的势力列表
	 *
	 * @param {Player} player - 玩家
	 * @returns {Record<string, string>} - 势力及其对应的名称
	 */
	getIdentityList(player) {
		// @ts-expect-error 祖宗之法就是这么写的
		if (!player.isUnseen()) {
			return;
		}
		// @ts-expect-error 祖宗之法就是这么写的
		if (player === game.me) {
			return;
		}

		let list = {
			wei: "魏",
			shu: "蜀",
			wu: "吴",
			qun: "群",
			jin: "晋",
			han: "汉",
			ye: "野",
			unknown: "猜",
		};
		return list;
	}

	tongling = {};

	getJunEquip() {
		return [
			[["wei"], ["heart", 13, "zhuahuang"], ["heart", 13, "liulongcanjia"]],
			[["shu"], ["spade", 2, "cixiong"], ["spade", 2, "feilongduofeng"]],
			[["wu"], ["diamond", 6, "wuliu"], ["diamond", 6, "dinglanyemingzhu"]],
			[["qun"], ["heart", 3, "jingfanma", null, ["lianheng"]], ["heart", 3, "taipingyaoshu"]],
			[["jin"], ["spade", 5, "jueying"], ["spade", 5, "linxiaoyuyu"]],
			[["han"], [null, null, null], ["heart", 9, "chixiaojian"]],
			[["han"], ["club", 1, "yuxi"], ["club", 1, "yuxi"]],
		];
	}

	getTongling(group) {

	getTongling(group) {
		if (!this.tongling) { this.tongling = {}; return []; }
		if (!(group in this.tongling)) return [];
		let t = [];
		for (let item of this.tongling[group]) {
			if (item.times > 0 && !t.includes(item.name)) t.push(item.name);
		}
		return t;
	}

	addTongling(group, name, times = Infinity) {
		if (!this.tongling) this.tongling = {};
		if (!(group in this.tongling)) this.tongling[group] = [];
		if (times === 1) {
			for (let item of this.tongling[group]) {
				if (item.name === name && item.times > 0) return false;
			}
		}
		this.tongling[group].push({ name, times });
		return true;
	}

	removeTongling(group, name) {
		if (!this.tongling) { this.tongling = {}; return; }
		if (!(group in this.tongling)) return;
		for (let i = 0; i < this.tongling[group].length; i++) {
			let item = this.tongling[group][i];
			if (item.name === name) {
				if (item.times === Infinity) {
					this.tongling[group].splice(i, 1);
				} else {
					item.times = 0;
				}
				return;
			}
		}
	}

	useTongling(group, name) {
		if (!this.tongling) { this.tongling = {}; return false; }
		if (!(group in this.tongling)) return false;
		for (let item of this.tongling[group]) {
			if (item.name === name && item.times > 0) {
				if (item.times === Infinity) return true;
				item.times--;
				return item.times > 0;
			}
		}
		return false;
	}

	/**
	 * `Game#addVideo`的类型兼容版本
	 */
	// @ts-expect-error 祖宗之法就是这么写的
	addVideo(type, player, content) {
		// @ts-expect-error 祖宗之法就是这么写的
		return super.addVideo(type, player, content);
	}
}

/**
 * `Game#broadcast`的类型兼容版本
 *
 * 未来或许会移动到别的地方，但目前先直接放国战里
 *
 * @template {(...args: any[]) => unknown} T
 * @param {T} func
 * @param {Parameters<T>} args
 */
export function broadcast(func, ...args) {
	// @ts-expect-error 类型就是这么写的
	return game.broadcast(func, ...args);
}

/**
 * `Game#broadcastAll`的类型兼容版本
 *
 * 未来或许会移动到别的地方，但目前先直接放国战里
 *
 * @template {(...args: any[]) => unknown} T
 * @param {T} func
 * @param {Parameters<T>} args
 */
export function broadcastAll(func, ...args) {
	// @ts-expect-error 类型就是这么写的
	return game.broadcastAll(func, ...args);
}
