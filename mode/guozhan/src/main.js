import { lib, game, ui, get, ai, _status } from "../../../noname.js";
import { broadcastAll } from "./patch/game.js";

function getRandomGroups(groups, banNumber) {
  // 复制数组避免修改原数组
  const shuffled = [...groups];

  // Fisher-Yates 洗牌算法
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // 返回前 banNumber 个元素
  return shuffled.slice(0, banNumber);
}

/**
 * @type {ContentFuncByAll}
 */
export const start = async (event, trigger, player) => {
	// 首先检查是否在播放录像
	const playback = localStorage.getItem(lib.configprefix + "playback");

	// 如果有录像信息，则尝试播放录像
	if (playback) {
		ui.create.me();
		ui.arena.style.display = "none";
		ui.system.style.display = "none";

		_status.playback = playback;
		localStorage.removeItem(lib.configprefix + "playback");

		// 读取录像信息
		// @ts-expect-error type error
		const store = lib.db.transaction(["video"], "readwrite").objectStore("video");
		store.get(parseInt(playback)).onsuccess = function (e) {
			if (e.target.result) {
				game.playVideoContent(e.target.result.video);
			} else {
				alert("播放失败：找不到录像");
				game.reload();
			}
		};

		// 录像或许需要对乱斗模式进行特殊的处理
		_status.mode = get.config("guozhan_mode");
		if (_status.brawl && _status.brawl.submode) {
			_status.mode = _status.brawl.submode;
		}
		if (get.config("separatism")) {
			// @ts-expect-error 祖宗之法就是这么写的
			_status.separatism = true;
		}

		return;
	}

	// 如果没有录像信息，则根据是否在联机模式进行不同的处理
	if (_status.connectMode) {
		// 等待玩家加入
		// @ts-expect-error 祖宗之法就是这么写的
		await game.waitForPlayer();

		// 获取当前模式的配置
		let mode = lib.configOL.guozhan_mode;
		_status.mode = mode;

		// 如果当前模式不在可选列表中，则默认为normal
		if (!["normal", "yingbian", "old"].includes(mode)) {
			_status.mode = mode = "normal";
		}

		if (lib.configOL.separatism) {
			// @ts-expect-error 祖宗之法就是这么写的
			_status.separatism = true;
		}

		// 决定当前模式下的牌堆
		switch (_status.mode) {
			case "old":
				// @ts-expect-error 祖宗之法就是这么写的
				lib.card.list = lib.guozhanPile_old.slice(0);
				break;
			case "yingbian":
				// @ts-expect-error 祖宗之法就是这么写的
				lib.card.list = lib.guozhanPile_yingbian.slice(0);
				delete lib.translate.shuiyanqijunx_info_guozhan;
				break;
			default:
				// @ts-expect-error 祖宗之法就是这么写的
				lib.card.list = lib.guozhanPile.slice(0);
				break;
		}

		// @ts-expect-error 祖宗之法就是这么写的
		game.fixedPile = true;

		// 向其他玩家广播当前模式
		broadcastAll(
			(mode, separatism) => {
				_status.mode = mode;
				if (separatism) {
					// @ts-expect-error 祖宗之法就是这么写的
					_status.separatism = true;
				}
				// @ts-expect-error 祖宗之法就是这么写的
				const pack = lib.characterPack.mode_guozhan;
				if (mode == "yingbian") {
					delete lib.translate.shuiyanqijunx_info_guozhan;
					// @ts-expect-error 祖宗之法就是这么写的
					const pack2 = lib.yingbian_guozhan;
					for (const i in pack2) {
						pack[i] = pack2[i];
					}
				}
				for (let i = 0; i < game.players.length; ++i) {
					game.players[i].node.name.hide();
					game.players[i].node.name2.hide();
				}
				for (const character in pack) {
					lib.character[character] = pack[character];
					if (!lib.translate["#" + character + ":die"] && !lib.character[character].dieAudios?.length) {
						let list = lib.character?.[character.slice(3)]?.dieAudios;
						lib.character[character].dieAudios = list?.length ? list : [character.slice(3)];
					}
					if (!lib.translate[character]) {
						lib.translate[character] = lib.translate[character.slice(3)];
					}
				}
				for (const character in lib.character) {
					if (lib.selectGroup.includes(lib.character[character][1]) || lib.character[character].groupInGuozhan) {
						lib.character[character].group = lib.character[character].groupInGuozhan || "qun";
					}
				}
				//lib.characterReplace={};
			},
			_status.mode,
			// @ts-expect-error 祖宗之法就是这么写的
			_status.separatism
		);

		await game.randomMapOL();
	} else {
		// 获取当前模式的配置
		let mode = get.config("guozhan_mode");
		_status.mode = mode;

		// 如果当前模式不在可选列表中，则默认为normal
		if (!["normal", "yingbian", "old", "free"].includes(mode)) {
			_status.mode = mode = "normal";
		}

		// 决定当前模式下的牌堆
		switch (_status.mode) {
			case "old":
				// @ts-expect-error 祖宗之法就是这么写的
				lib.card.list = lib.guozhanPile_old.slice(0);
				break;
			case "yingbian": {
				// @ts-expect-error 祖宗之法就是这么写的
				lib.card.list = lib.guozhanPile_yingbian.slice(0);
				delete lib.translate.shuiyanqijunx_info_guozhan;
				// @ts-expect-error 祖宗之法就是这么写的
				const pack = lib.yingbian_guozhan;
				for (const i in pack) {
					lib.character[i] = pack[i];
					// @ts-expect-error 祖宗之法就是这么写的
					lib.characterPack.mode_guozhan[i] = pack[i];
					if (!lib.translate["#" + i + ":die"] && !lib.character[i].dieAudios?.length) {
						let list = lib.character?.[i.slice(3)]?.dieAudios;
						lib.character[i].dieAudios = list?.length ? list : [i.slice(3)];
					}
					if (!lib.translate[i]) {
						lib.translate[i] = lib.translate[i.slice(3)];
					}
				}
				break;
			}
			case "normal":
				// @ts-expect-error 祖宗之法就是这么写的
				lib.card.list = lib.guozhanPile.slice(0);
				break;
		}

		if (_status.mode != "free") {
			// @ts-expect-error 祖宗之法就是这么写的
			game.fixedPile = true;
		} else {
			delete lib.translate.shuiyanqijunx_info_guozhan;
		}

		game.prepareArena();
		// game.delay();
		game.showChangeLog();

		if (_status.brawl && _status.brawl.submode) {
			_status.mode = _status.brawl.submode;
		}
		if (get.config("separatism")) {
			// @ts-expect-error 祖宗之法就是这么写的
			_status.separatism = true;
		}

		for (let i = 0; i < game.players.length; ++i) {
			game.players[i].node.name.hide();
			game.players[i].node.name2.hide();
			game.players[i].getId();
		}

		const groups = ["wei", "shu", "wu", "qun", "jin","han"];
    let banNumber = parseInt(get.config("banGroup"));
    if (banNumber > 0) {
        const banGroups = getRandomGroups(groups, banNumber);
        let videoId = lib.status.videoId++;
        let createDialog = function (group, id) {
        _status.bannedGroups = banGroups;
        // 将禁用势力数组转换为翻译后的字符串
        const bannedGroupsText = banGroups.map(group => get.translation(group)).join('、');
        var dialog = ui.create.dialog(`本局禁用势力：${bannedGroupsText}`,[banGroups,"vcard"],"forcebutton");
        dialog.videoId = id;
        };
        // 一次性记录所有禁用势力的日志
        const bannedGroupsText = banGroups.map(group =>
            `<span data-nature="${get.groupnature(group, "raw")}">${get.translation(group)}势力</span>`
        ).join('、');

        game.log("本局", bannedGroupsText, "遭到了禁用");

        // 循环广播每个势力的对话框
        banGroups.forEach(group => {
            game.broadcastAll(createDialog, `group_${group}`, event.videoId);
        });
        // 完整的势力禁用逻辑 - 单段代码实现
				const updatedCharacters = new Map();
				if(lib.config.extension_qj_kejiang){
					// 第一步：检查所有角色是否需要启用客将势力
					for (const character in lib.character) {
							const info = get.character(character);
							if (!info) continue;

							// 计算角色的所有原势力（主势力 + 双势力）
							const originalGroups = [info.group];
							if (info.doubleGroup?.length) {
									originalGroups.push(...info.doubleGroup);
							}
							const uniqueOriginalGroups = [...new Set(originalGroups)];
							
							// 检查角色的所有原势力是否都被禁用
							const allOriginalGroupsBanned = uniqueOriginalGroups.every(group => banGroups.includes(group));
							
							// 如果所有原势力都被禁用且有客将势力，则启用客将势力
							if (allOriginalGroupsBanned && info.keGroup && info.keGroup.length > 0) {
									// 过滤客将势力中的禁用势力
									const validKeGroups = info.keGroup.filter(group => !banGroups.includes(group));
									
									if (validKeGroups.length === 0) {
											// 客将势力也全部被禁用，标记为不可见
											info.isUnseen = true;
									} else if (validKeGroups.length === 1) {
											// 只有一个有效客将势力，设置为单势力
											info.group = validKeGroups[0];
											info.doubleGroup = [];
									} else {
											// 多个有效客将势力，设置为双势力
											info.doubleGroup = validKeGroups;
											info.group = validKeGroups[0];
									}
									
									// 更新客将势力为过滤后的版本
									info.keGroup = validKeGroups;
									updatedCharacters.set(character, info);
							}
					}
				}
				// 第二步：处理双势力角色（包括可能刚设置了客将势力的角色）
				for (const character in lib.character) {
						const info = get.character(character);
						if (!info) continue;

						let updated = false;

						// 处理双势力中的禁用势力
						if (info.doubleGroup?.length) {
								const originalDoubleLength = info.doubleGroup.length;
								info.doubleGroup = info.doubleGroup.filter(group => !banGroups.includes(group));
								
								if (info.doubleGroup.length !== originalDoubleLength) {
										updated = true;
								}

								// 如果当前主势力被禁用且还有其他可用势力，切换到第一个可用势力
								if (banGroups.includes(info.group) && info.doubleGroup.length > 0) {
										info.group = info.doubleGroup[0];
										updated = true;
								}

								// 双势力只剩一个时清除双势力标记
								if (info.doubleGroup.length === 1) {
										info.doubleGroup = [];
										updated = true;
								}
						}

						// 处理客将势力中的禁用势力（如果有）
						if (info.keGroup?.length) {
								const originalKeLength = info.keGroup.length;
								info.keGroup = info.keGroup.filter(group => !banGroups.includes(group));
								if (info.keGroup.length !== originalKeLength) {
										updated = true;
								}
						}

						if (updated) {
								updatedCharacters.set(character, info);
						}
				}

				// 第三步：最终检查 - 确保每个角色都有可用势力
				for (const character in lib.character) {
						const info = get.character(character);
						if (!info) continue;

						// 计算角色当前的所有可用势力（包括主势力、双势力和客将势力）
						const currentGroups = [info.group];
						if (info.doubleGroup?.length) {
								currentGroups.push(...info.doubleGroup);
						}
						if (info.keGroup?.length) {
								currentGroups.push(...info.keGroup);
						}
						const uniqueCurrentGroups = [...new Set(currentGroups)];
						
						// 检查角色是否有任何可用势力（不被禁用的势力）
						const hasValidGroup = uniqueCurrentGroups.some(group => !banGroups.includes(group));
						
						if (!hasValidGroup) {
								// 没有任何可用势力，标记为不可见
								if (!info.isUnseen) {
										info.isUnseen = true;
										updatedCharacters.set(character, info);
								}
						} else {
								// 检查主势力是否被禁用
								if (banGroups.includes(info.group)) {
										// 主势力被禁用，需要切换到其他可用势力
										const availableGroups = uniqueCurrentGroups.filter(group => !banGroups.includes(group));
										if (availableGroups.length > 0) {
												info.group = availableGroups[0];
												
												// 如果只有一个可用势力，清除双势力标记
												if (availableGroups.length === 1 && info.doubleGroup?.length) {
														info.doubleGroup = [];
												}
												
												updatedCharacters.set(character, info);
										}
								}
						}
				}

				// 第四步：广播所有更新
				let broadcastCount = 0;
				updatedCharacters.forEach((info, character) => {
						game.broadcast((name, characterInfo) => {
								get.character(name) = characterInfo;
						}, character, info);
						broadcastCount++;
				});
				await game.delay(5);
        game.broadcastAll("closeDialog", videoId);
    }

		if (_status.brawl && _status.brawl.chooseCharacterBefore) {
			await _status.brawl.chooseCharacterBefore();
		}

		// @ts-expect-error 祖宗之法就是这么写的
		await game.chooseCharacter();
	}

	// 后面暂时不加注释了，等重构吧
	if (ui.coin) {
		_status.coinCoeff = get.coinCoeff([game.me.name1, game.me.name2]);
	}

	let playerFirst;
	// @ts-expect-error 祖宗之法就是这么写的
	if (_status.cheat_seat) {
		// @ts-expect-error 祖宗之法就是这么写的
		let seat = _status.cheat_seat.link;
		if (seat == 0) {
			playerFirst = game.me;
		} else {
			playerFirst = game.players[game.players.length - seat];
		}
		if (!playerFirst) {
			playerFirst = game.me;
		}
		// @ts-expect-error 祖宗之法就是这么写的
		delete _status.cheat_seat;
	} else {
		playerFirst = game.players[Math.floor(Math.random() * game.players.length)];
	}

	await event.trigger("gameStart");

	await game.gameDraw(playerFirst);
	broadcastAll(player => {
		for (let i = 0; i < game.players.length; ++i) {
			var seatNum = get.distance(player, game.players[i], "absolute");
			game.players[i].name = `unknown${seatNum}`;
			game.players[i].node.name_seat = ui.create.div(".name.name_seat", get.seatTranslation(seatNum), game.players[i]);
			// if(game.players[i]==game.me){
			// 	lib.translate[game.players[i].name]+='（你）';
			// }
		}
	}, playerFirst);

	const players = get.players(lib.sort.position);
	const info = [];
	for (let i = 0; i < players.length; ++i) {
		info.push({
			name: game.players[i].name,
			translate: lib.translate[game.players[i].name],
			name1: players[i].name1,
			name2: players[i].name2,
			nickname: players[i].node.nameol.innerHTML,
		});
	}

	// @ts-expect-error 祖宗之法就是这么写的
	_status.videoInited = true;
	game.addVideo("init", null, info);

	if (_status.mode == "mingjiang") {
		// @ts-expect-error 祖宗之法就是这么写的
		game.showIdentity(true);
	} else {
		for (let i = 0; i < game.players.length; ++i) {
			game.players[i].ai.shown = 0;
		}
	}
	if (_status.connectMode && lib.configOL.change_card) {
		game.replaceHandcards(game.players.slice(0));
	}

	await game.phaseLoop(playerFirst);
}

export const startBefore = () => {
	const playback = localStorage.getItem(lib.configprefix + "playback");

	// @ts-expect-error 祖宗之法就是这么写的
	for (let character in lib.characterPack.mode_guozhan) {
		if (!get.config("onlyguozhan") && !playback) {
			if (lib.character[character.slice(3)]) {
				continue;
			}
		}
		// @ts-expect-error 祖宗之法就是这么写的
		lib.character[character] = lib.characterPack.mode_guozhan[character];
		if (!lib.translate["#" + character + ":die"] && !lib.character[character].dieAudios?.length) {
			let list = lib.character?.[character.slice(3)]?.dieAudios;
			lib.character[character].dieAudios = list?.length ? list : [character.slice(3)];
		}
		if (!lib.translate[character]) {
			lib.translate[character] = lib.translate[character.slice(3)];
		}
	}
	for (const character in lib.character) {
		if (lib.selectGroup.includes(lib.character[character].group) || lib.character[character].groupInGuozhan) {
			lib.character[character].group = lib.character[character].groupInGuozhan || "qun";
		}
	}
}

export const onreinit = () => {
	// @ts-expect-error 祖宗之法就是这么写的
	const pack = lib.characterPack.mode_guozhan;

	for (const character in pack) {
		lib.character[character] = pack[character];
		if (!lib.translate["#" + character + ":die"] && !lib.character[character].dieAudios?.length) {
			let list = lib.character?.[character.slice(3)]?.dieAudios;
			lib.character[character].dieAudios = list?.length ? list : [character.slice(3)];
		}
		if (!lib.translate[character]) {
			lib.translate[character] = lib.translate[character.slice(3)];
		}
	}

	for (const character in lib.character) {
		if (lib.selectGroup.includes(lib.character[character].group) || lib.character[character].groupInGuozhan) {
			lib.character[character].group = lib.character[character].groupInGuozhan || "qun";
		}
	}
}
