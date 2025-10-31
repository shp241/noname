// 从指定commit起，找到所有修改过的文件，做成文件覆盖的补丁包
// 使用 node game/generatePatch.js commitHash
// 注意，需要先在游戏目录下执行 git log --oneline -10
// 命令参数是对应commit的SHA
// 生成的压缩包在game目录下，文件名格式：补丁包-YYYYMMDD.zip
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const JSZip = require("./jszip.js");

const joinRootPath = p => path.join(__dirname, "../", p);

function formatDate(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}${month}${day}`;
}

function execCommand(command) {
	return new Promise((resolve, reject) => {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				reject({ error, stderr });
				return;
			}
			resolve(stdout.trim());
		});
	});
}

async function generatePatch(commitHash) {
	try {
		console.log(`正在获取从 ${commitHash} 起的修改文件列表...`);
		
		// 使用 git diff --name-only 获取从指定commit到HEAD的所有修改文件
		// commitHash^..HEAD 表示从commitHash的前一个commit到HEAD的所有修改
		// 或者使用 commitHash..HEAD 表示从commitHash到HEAD的所有修改
		const command = `git diff --name-only ${commitHash}..HEAD`;
		console.log(`执行命令: ${command}`);
		
		const stdout = await execCommand(command);
		
		if (!stdout) {
			console.log("没有找到修改的文件。");
			return;
		}
		
		// 分割文件列表并过滤空行
		let filesArray = stdout.split("\n").filter(v => {
			v = v.trim();
			if (!v) return false;
			
			const filePath = path.join(__dirname, "../", v);
			// 只包含实际存在的文件，排除已删除的文件
			return fs.existsSync(filePath) && fs.lstatSync(filePath).isFile();
		});
		
		if (filesArray.length === 0) {
			console.log("没有找到需要打包的文件（可能是所有修改的文件都已被删除）。");
			return;
		}
		
		// 去重并排序
		filesArray = [...new Set(filesArray.map(v => v.replace(/\\/g, "/")))].sort((a, b) => {
			if (a > b) return 1;
			if (a < b) return -1;
			return 0;
		});
		
		console.log(`找到 ${filesArray.length} 个修改的文件:`);
		filesArray.forEach((file, index) => {
			console.log(`  ${index + 1}. ${file}`);
		});
		
		// 创建ZIP压缩包
		const zip = new JSZip();
		
		console.log("\n正在打包文件...");
		let successCount = 0;
		let errorCount = 0;
		
		filesArray.forEach(v => {
			const filePath = path.join(__dirname, "../", v);
			try {
				if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
					const fileContent = fs.readFileSync(filePath);
					// 确保路径使用正斜杠
					const zipPath = v.replace(/\\/g, "/");
					zip.file(zipPath, fileContent);
					successCount++;
				}
			} catch (error) {
				console.error(`读取文件失败: ${v}`, error);
				errorCount++;
			}
		});
		
		if (successCount === 0) {
			console.log("没有成功打包任何文件。");
			return;
		}
		
		if (errorCount > 0) {
			console.log(`警告: 有 ${errorCount} 个文件打包失败。`);
		}
		
		// 生成ZIP文件
		console.log("\n正在生成ZIP文件...");
		const result = zip.generate({ type: "nodebuffer" });
		
		const outputFileName = `补丁包-${formatDate()}.zip`;
		const outputPath = path.join(__dirname, outputFileName);
		fs.writeFileSync(outputPath, result);
		
		console.log(`\n成功生成补丁包: ${outputPath}`);
		console.log(`包含 ${successCount} 个文件，文件大小: ${(result.length / 1024).toFixed(2)} KB`);
		
	} catch (err) {
		console.error("生成补丁包时出错:", err);
		if (err.error) {
			console.error("Git命令错误:", err.error.message);
		}
		if (err.stderr) {
			console.error("错误信息:", err.stderr);
		}
	}
}

// 检查命令行参数
const commitHash = process.argv[2];

if (!commitHash) {
	console.log("使用方法: node game/generatePatch.js <commitHash>");
	console.log("示例: node game/generatePatch.js abc1234");
	console.log("\n查看最近的commit:");
	console.log("  git log --oneline -10");
	process.exit(1);
}

generatePatch(commitHash);

