import shell from "shelljs";
import { getCleanTaskName, log, sleep } from "./utils";
import scraper from "./steps/scraper";
import Piscina from "piscina";
import { executeTasks } from "./task";
import { config } from "./config";
import { ensurePlatform } from "./utils/platform";
import { clearWorkshop } from "./utils/workshop";
import { initAria2c, stopAria2c } from "./cli/aria2c";
import {
  modified,
  readDatabase,
  report,
  setDatabaseNodeFailure,
  setDatabaseNodeSuccess,
  writeDatabase,
} from "./utils/database";
import { login, uploadToRemote } from "./cli/cloud189";
import { uploadToRemote as rcloneUploadToRemote } from "./cli/rclone";
import art from "./utils/art";
import fs from "fs";
import cp from "child_process";
import { TaskInstance } from "./types/class";
import { DOWNLOAD_SERVE_CACHE, setMVTDayToday } from "./const";
import { printLoadEnvNotices } from "./utils/env";
import { getAllTasks, getSingleTask } from "./task/getter";
import {
  getTasksToBeExecuted,
  removeExtraBuilds,
  reserveTask,
} from "./task/utils";
import path from "path";
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

// eslint-disable-next-line @typescript-eslint/no-var-requires
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("source-map-support").install();

async function main(): Promise<boolean> {
  // 打印艺术字
  art();
  // 删除日志文件
  if (fs.existsSync("bot.log")) {
    fs.unlinkSync("bot.log");
  }
  // 删除生产缓存
  if (fs.existsSync(DOWNLOAD_SERVE_CACHE)) {
    shell.rm("-rf", DOWNLOAD_SERVE_CACHE);
  }
  // 打印环境变量加载
  printLoadEnvNotices();
  // GA模式特殊处理
  if (config.GITHUB_ACTIONS) {
    console.log("::group::Console Log");
    // 获取database
    if (config.DATABASE_UPDATE && config.REMOTE_ENABLE) {
      cp.execSync("rclone copy pineapple:/hdisk/Bot/database.json ./");
      log("Info:Database pulled");
    } else {
      // 从https获得只读数据库
      cp.execSync(
        "curl https://pineapple.edgeless.top/Bot/database.json -o database.json",
      );
      log("Info:Readonly database pulled");
    }
    const loginRes = login();
    if (!loginRes) {
      return false;
    }
  }
  // 处理无版本号任务的制作日
  if (config.MODE_FORCED) setMVTDayToday();
  // 平台命令校验
  const platformMode = ensurePlatform();
  if (platformMode == "Unavailable") {
    return false;
  }
  // 重建工作目录
  if (!clearWorkshop()) {
    log(`Error:Can't keep workshop clear : ${config.DIR_WORKSHOP}`);
    return false;
  }
  // 启动aria2c
  if (!(await initAria2c())) {
    log("Error:Can't initiate aria2c");
    return false;
  }
  // 读取数据库
  readDatabase();
  // 读取全部任务
  let tasks: TaskInstance[], task: TaskInstance;
  if (config.SPECIFY_TASK) {
    // 分割分别获取任务
    tasks = [];
    for (const t of config.SPECIFY_TASK.toString().split(/[,\s]/)) {
      task = getSingleTask(t).unwrap();
      // 判断是否保留任务
      if (!reserveTask(task)) {
        continue;
      }
      tasks.push(task);
    }
  } else {
    tasks = getAllTasks().unwrap();
  }
  // 执行全部爬虫
  const results = await scraper(tasks);
  // console.log(JSON.stringify(results,null,2))

  // 得到需要制作的任务
  const toExecTasks = getTasksToBeExecuted(results);

  // 执行任务
  const eRes = await executeTasks(toExecTasks);
  for (const node of eRes) {
    if (node.result.ok) {
      const task = getSingleTask(node.taskName).unwrap();
      const fileNames = node.result.val;
      const metaNames = fileNames.map((n) => `${n}.meta`);
      // 上传
      if (uploadToRemote(fileNames.concat(metaNames), task.scope, task.name)) {
        // 去重
        const newBuilds = removeExtraBuilds(
          node.taskName,
          task.scope,
          fileNames,
        );
        // 复制 meta 文件并上传
        const cleanTaskName = getCleanTaskName(node.taskName);
        const sourcePath = path.join(
          config.DIR_BUILDS,
          task.scope,
          cleanTaskName,
        );
        const metaLocalPath = path.join(
          config.DIR_META,
          task.scope,
          cleanTaskName,
        );
        if (!existsSync(metaLocalPath)) {
          await mkdir(metaLocalPath, { recursive: true });
        }
        for (const name of metaNames) {
          await copyFile(
            path.join(sourcePath, name),
            path.join(metaLocalPath, name),
          );
          // 尽力而为上传，忽略失败
          rcloneUploadToRemote(name, task.scope, cleanTaskName);
        }

        setDatabaseNodeSuccess(node.taskName, newBuilds, fileNames);
      } else {
        setDatabaseNodeFailure(node.taskName, "Error:Can't upload target file");
      }
    } else {
      setDatabaseNodeFailure(node.taskName, node.result.val);
    }
  }

  // 保存数据库
  writeDatabase();
  // 停止aria2c
  await stopAria2c();
  log("Info:Aria2c exited");

  // 打印报告
  if (config.GITHUB_ACTIONS) {
    console.log("::endgroup::");
  }
  return report();
}

if (!Piscina.isWorkerThread) {
  main().then(async (result) => {
    await sleep(1000);
    if (config.GITHUB_ACTIONS && config.DATABASE_UPDATE && modified) {
      // 回传数据库
      cp.execSync("rclone copy ./database.json pineapple:/hdisk/Bot/");
      log("Info:Database pushed");
    }
    process.exit(result ? 0 : 1);
  });
}
