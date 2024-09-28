import os from "os";
import fs from "fs";
import { fromGBK, getCleanTaskName, getTimeString, log } from "../utils";
import cp from "child_process";
import path from "path";
import { config } from "../config";

type ExecSyncError = { output: { toString: () => string } } | undefined;

export function login(): boolean {
  if (!config.GITHUB_ACTIONS) {
    return false;
  }
  const configPath = path.join(os.homedir(), ".config/cloud189/config.json");
  if (!fs.existsSync(configPath)) {
    log(`Error:Can't find cloud189 config path : ${configPath}`);
    return false;
  }
  try {
    const {
      user: { name, password },
    } = JSON.parse(fs.readFileSync(configPath).toString()) as {
      user: {
        name: string;
        password: string;
      };
    };
    log("Info:Login to cloud189...");
    cp.execSync(`cloud189 login -i ${name} ${password}`);
  } catch (e) {
    log(`Error:Failed to login to cloud189 : ${e}`);
    return false;
  }
  return true;
}

export function uploadToRemote(
  fileNames: string[],
  scope: string,
  taskName: string,
): boolean {
  if (config.REMOTE_ENABLE) {
    for (const fileName of fileNames) {
      const cleanTaskName = getCleanTaskName(taskName);
      const localPath = path.join(
        config.DIR_BUILDS,
        scope,
        cleanTaskName,
        fileName,
      );
      const remotePath = path
        .join(config.REMOTE_PATH, scope, cleanTaskName)
        .replaceAll("\\", "/");

      let date = new Date();
      const startTime = date.getTime();

      try {
        log(`Info:Uploading '${localPath}' to '${remotePath}'`);
        // 先尝试移除这个文件
        deleteFromRemote(fileName, scope, taskName, true);
        cp.execSync(`cloud189 up "${localPath}" ${remotePath}`);
      } catch (err: unknown) {
        console.log((err as ExecSyncError)?.output.toString());
        date = new Date();
        log(
          `Info:Cost ${getTimeString(
            date.getTime() - startTime,
          )} before error occurred`,
        );
        // 尝试删除传了一半的文件
        log("Info:Trying to delete broken uploaded file");
        if (!deleteFromRemote(fileName, scope, taskName, true)) {
          log("Warning:Fail to delete broken uploaded file");
        } else {
          log("Info:Deleted broken uploaded file");
        }

        return false;
      }
      date = new Date();
      log(
        `Info:Uploaded successfully, cost ${getTimeString(
          date.getTime() - startTime,
        )}`,
      );
    }
  } else {
    log("Warning:Remote disabled, skip upload to remote");
  }

  return true;
}

export function deleteFromRemote(
  fileName: string,
  scope: string,
  taskName: string,
  ignoreNotExist?: boolean,
): boolean {
  if (config.REMOTE_ENABLE) {
    const cleanTaskName = getCleanTaskName(taskName);
    const remoteDir = path
      .join(config.REMOTE_PATH, scope, cleanTaskName)
      .replaceAll("\\", "/");
    const remotePath = path.join(remoteDir, fileName).replaceAll("\\", "/");
    // 读取远程目录查看是否存在
    let buf;
    try {
      buf = cp.execSync(`cloud189 ls ${remoteDir}`);
    } catch (err: unknown) {
      console.log((err as ExecSyncError)?.output.toString());
      log(
        `Error:Remote directory not exist:${config.REMOTE_NAME}:${remoteDir}`,
      );
      return false;
    }
    // log(`Info:Debug - run deleteFromRemote with remotePath=${remotePath};\n gbk(buf)=${gbk(buf)},\n buf.toString()=${buf.toString()}`)
    if (
      !fromGBK(buf).includes(fileName) &&
      !buf.toString().includes(fileName) &&
      (ignoreNotExist == undefined || !ignoreNotExist)
    ) {
      log(
        `Warning:Remote not exist file : ${config.REMOTE_NAME}:${remotePath} ,ignore`,
      );
      return true;
    }

    // 尝试删除
    try {
      log(`Info:Removing ${remotePath}`);
      cp.execSync(`cloud189 rm "${remotePath}"`);
    } catch (err: unknown) {
      console.log((err as ExecSyncError)?.output.toString());
      return false;
    }

    log("Info:Removed successfully");
  } else {
    log("Warning:Remote disabled, skip delete from remote");
  }

  return true;
}
