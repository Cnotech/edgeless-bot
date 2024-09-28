import chalk from "chalk";
import fs from "fs";
import path from "path";
import { Err, Ok, Result } from "ts-results";
import Ajv, { ValidateFunction } from "ajv";
import iconv from "iconv-lite";
import {
  JsObjectType,
  ObjectValidationNode,
  TaskInstance,
} from "../types/class";
import { badge } from "../worker";
import Piscina from "piscina";
import cp from "child_process";
import { PROJECT_ROOT } from "../const";
import TOML from "@iarna/toml";
import { createHash } from "node:crypto";

export enum Cmp {
  L,
  E,
  G,
}

export function print(text: unknown, ga_mode: boolean, badge?: string) {
  // 增加字符串类型判断
  if (typeof text !== "string") {
    console.log(
      `${
        (badge ? `${badge} ` : "") + chalk.yellow("Warning ")
      }Illegal type detected`,
    );
    console.log(JSON.stringify(text));
    return;
  }

  const spl = text.split(":");
  if (spl.length < 2) {
    console.log(
      `${
        (badge ? `${badge} ` : "") + chalk.yellow("Warning ")
      }Illegal message detected`,
    );
    console.log(text);
    return;
  }

  const inf = text.substring(spl[0].length + 1);
  switch (spl[0]) {
    case "Info":
      if (ga_mode) {
        console.log((badge ? `${badge} ` : "") + chalk.blue("Info: ") + inf);
      } else {
        console.log((badge ? `${badge} ` : "") + chalk.blue("Info ") + inf);
      }

      break;
    case "Success":
      if (ga_mode) {
        console.log(
          (badge ? `${badge} ` : "") + chalk.greenBright("Success: ") + inf,
        );
      } else {
        console.log(
          (badge ? `${badge} ` : "") + chalk.greenBright("Success ") + inf,
        );
      }

      break;
    case "Warning":
      if (ga_mode) {
        console.log(`::warning::${inf}`);
      } else {
        console.log(
          (badge ? `${badge} ` : "") + chalk.yellow("Warning ") + inf,
        );
      }

      break;
    case "Error":
      if (ga_mode) {
        console.log(`::error::${inf}`);
      } else {
        console.log((badge ? `${badge} ` : "") + chalk.red("Error ") + inf);
      }

      break;
    default:
      if (ga_mode) {
        console.log(`::warning::Illegal message detected:${inf}`);
      } else {
        console.log(
          `${
            (badge ? `${badge} ` : "") + chalk.yellow("Warning ")
          }Illegal message detected`,
        );
        console.log(text);
      }
  }
}

/**
 * 通用日志输出封装，支持的日志格式为： [Level]:[Content]，有效的 [Level] 枚举取值为：Info、Warning、Error、Success
 * 示例： Info:This is a message
 * @param text 日志内容
 * @param b （可选）徽章
 */
export function log(text: string, b?: string) {
  let d = b;
  if (b == null && Piscina.isWorkerThread) {
    d = badge;
  }
  print(text, false, d);
  if (!text.startsWith("Info:")) {
    fs.appendFileSync("bot.log", `${text}\n`);
  }
}

/**
 * 格式化版本号
 * @param version 原版本号
 * @param clearLast 是否将最后一位（第4位）置0
 * @returns
 */
export function formatVersion(
  version: string,
  clearLast = false,
): Result<string, string> {
  let spl = version.split(".");

  // 清理多余的 0 前缀
  spl = spl.map((raw) => {
    if (raw.startsWith("0") && raw.length > 1) {
      return raw.slice(1);
    } else {
      return raw;
    }
  });

  // 确保符合 ExSemVer 位数要求
  if (spl.length > 4) {
    // 削减长的版本号
    log(`Warning:Slice long version: ${version}`);
  }

  // 处理最后一位
  const rawLast = spl[3] ?? "0";
  const finalLast = clearLast ? "0" : rawLast;

  return new Ok(`${spl[0]}.${spl[1] ?? "0"}.${spl[2] ?? "0"}.${finalLast}`);
}

export function matchVersion(text: string): Result<string, string> {
  const regex = /(\d+\.)+\d+/;
  const matchRes = text.match(regex);
  if (!matchRes || matchRes.length === 0) {
    return new Err(`Error:Matched no version with ${text}"`);
  }

  return new Ok(matchRes[0]);
}

export function isURL(str_url: string): boolean {
  return str_url.slice(0, 4) == "http";
}

export function getSizeString(size: number): string {
  if (size < 1024) {
    return `${size.toFixed(2)}B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)}KB`;
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)}MB`;
  } else {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }
}

export function getTimeString(ms: number): string {
  const s = ms / 1000;
  if (s < 60) {
    return `${s.toFixed(1)} s`;
  } else {
    return `${(s / 60).toFixed(1)} min`;
  }
}

export function getVersionFromFileName(fileName: string): string {
  let name = fileName;
  if (name.endsWith(".nep")) {
    name = name.slice(0, -4);
  }
  const sp = name.split("_");
  return sp[sp.length - 2];
}

export function getAuthorForFileName(author: TaskInstance["author"]): string {
  return author[0].split("<")[0].trim();
}

export function versionCmp(a: string, b: string): Cmp {
  const x = a.split(".");
  const y = b.split(".");
  let result: Cmp = Cmp.E;

  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (Number(x[i]) < Number(y[i])) {
      result = Cmp.L;
      break;
    } else if (Number(x[i]) > Number(y[i])) {
      result = Cmp.G;
      break;
    }
  }

  // 处理前几位版本号相同但是位数不一致的情况，如1.3/1.3.0
  if (result === Cmp.E && x.length !== y.length) {
    // 找出较长的那一个
    const t: Array<string> = x.length < y.length ? y : x;
    // 读取剩余位
    for (
      let i = Math.min(x.length, y.length);
      i < Math.max(x.length, y.length);
      i++
    ) {
      if (Number(t[i]) !== 0) {
        result = x.length < y.length ? Cmp.L : Cmp.G;
        break;
      }
    }
  }

  return result;
}

export async function awaitWithTimeout<P, R>(
  closure: (payload: P) => Promise<R>,
  timeout: number,
  payload: P,
): Promise<R> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject("Await failed due to timeout");
    }, timeout);
    closure(payload)
      .then(resolve)
      .catch((e) => reject(e.toString()));
  });
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const ajvCache: Record<string, ValidateFunction<unknown>> = {};
export function getValidator(
  name: string,
): Result<ValidateFunction<unknown>, string> {
  if (!ajvCache[name]) {
    // 读取schema文件
    const schemaFilePath = path.join("./schema", `${name}.json`);
    if (!fs.existsSync(schemaFilePath)) {
      return new Err(`Error:Specified schema not found : ${schemaFilePath}`);
    }
    const schemaJson = JSON.parse(fs.readFileSync(schemaFilePath).toString());

    const ajv = new Ajv({
      allowUnionTypes: true,
    });
    ajvCache[name] = ajv.compile(schemaJson);
  }
  ajvCache[name].errors = [];
  return new Ok(ajvCache[name]);
}

export function schemaValidator(
  obj: unknown,
  schema: string,
  root?: string,
): Result<boolean, string> {
  const vRes = getValidator(schema);
  if (vRes.err) return vRes;
  const validate = vRes.unwrap();

  if (validate(obj)) {
    return new Ok(true);
  } else {
    validate.errors?.forEach((item) => {
      log(`Error:At ${root ?? `${item.instancePath}`} : ${item.message}`);
    });
    return new Ok(false);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function objChainValidator(obj: any, chain: string[]): boolean {
  if (!(chain[0] in obj)) {
    return false;
  }
  // 当chain数组大于1时进行递归
  if (chain.length > 1) {
    return objChainValidator(obj[chain[0]], chain.slice(1));
  } else {
    return true;
  }
}

export function requiredKeysValidator(
  obj: object,
  requiredKeys: string[],
  disableAlert?: boolean,
): boolean {
  let suc = true,
    keys = [];
  for (const originalString of requiredKeys) {
    keys = originalString.split(".");
    if (!objChainValidator(obj, keys)) {
      log(
        `${
          disableAlert ? "Warning" : "Error"
        }:Missing ${originalString} in task config`,
      );
      suc = false;
      break;
    }
  }
  return suc;
}

export function objectValidator(
  object: Record<string, unknown>,
  checkList: Array<ObjectValidationNode>,
  cd?: string,
): boolean {
  let valid = true;
  for (const node of checkList) {
    // 检验必须但缺失
    if (node.required && object[node.key] == null) {
      log(`Error:Missing required key : ${node.key}`);
      valid = false;
      continue;
    }
    // 检验类型错误
    const getType = function (a: unknown): JsObjectType {
      let res;
      switch (typeof a) {
        case "number":
          res = JsObjectType.numberOrEnum;
          break;
        case "string":
          res = JsObjectType.string;
          break;
        case "boolean":
          res = JsObjectType.boolean;
          break;
        case "object":
          res = JsObjectType.object;
          break;
        case "function":
          res = JsObjectType.function;
          break;
        default:
          res = JsObjectType.invalid;
          break;
      }
      return res;
    };
    const explainType = function (b: JsObjectType): string {
      let res;
      switch (b) {
        case JsObjectType.numberOrEnum:
          res = "numberOrEnum";
          break;
        case JsObjectType.string:
          res = "string";
          break;
        case JsObjectType.boolean:
          res = "boolean";
          break;
        case JsObjectType.object:
          res = "object";
          break;
        case JsObjectType.function:
          res = "function";
          break;
        default:
          res = "invalid";
          break;
      }
      return res;
    };
    if (object[node.key] != null && getType(object[node.key]) != node.type) {
      log(
        `Error:Expect typeof ${cd ?? ""}${node.key} to be ${explainType(
          node.type,
        )},got ${typeof object[node.key]}`,
      );
      valid = false;
      continue;
    }
    // 递归检验对象
    if (
      node.type == JsObjectType.object &&
      object[node.key] != null &&
      node.properties
    ) {
      valid = objectValidator(
        object[node.key] as Record<string, unknown>,
        node.properties,
        `${cd ?? ""}${node.key}.`,
      );
    }
  }
  return valid;
}

export function toGBK(text: string): Buffer {
  return iconv.encode(text, "GBK");
}

export function fromGBK(b: Buffer): string {
  return iconv.decode(b, "GBK");
}

export function tomlStringify(obj: object): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return TOML.stringify(obj as any);
}

export function parseBuiltInValueForObject<T>(
  obj: T,
  v: {
    taskName: string;
    downloadedFile: string;
    latestVersion: string;
    revisedVersion?: string;
  },
): T {
  const text = JSON.stringify(obj);
  const parsed = parseBuiltInValue(text, v, false);
  return JSON.parse(parsed);
}

export function shuffle<T>(arr: Array<T>): Array<T> {
  let n = arr.length,
    random;
  while (0 != n) {
    random = (Math.random() * n--) >>> 0;
    [arr[n], arr[random]] = [arr[random], arr[n]];
  }
  return arr;
}

// TODO:拓展内置变量解析的覆盖范围
export function parseBuiltInValue(
  source: string,
  v: {
    taskName: string;
    downloadedFile: string;
    latestVersion: string;
    revisedVersion?: string;
  },
  regexOptimizing?: boolean,
): string {
  return source
    .replaceAll("${taskName}", v.taskName)
    .replaceAll("${downloadedFile}", v.downloadedFile)
    .replaceAll(
      "${latestVersion}",
      regexOptimizing
        ? v.latestVersion.replace(".0", "(.0)*").replace(".", "\\.")
        : v.latestVersion,
    )
    .replaceAll("${revisedVersion}", v.revisedVersion ?? v.latestVersion);
}

export function wherePECMD(): Result<string, string> {
  const p = [".\\pecmd.exe", ".\\bin\\pecmd.exe"];
  let r = "";
  for (const i of p) {
    if (fs.existsSync(path.join(PROJECT_ROOT, i))) {
      r = path.join(PROJECT_ROOT, i);
      break;
    }
  }
  if (r == "") {
    return new Err(
      'Error:Can\'t find pecmd.exe, store it to project root or "bin" folder',
    );
  } else {
    return new Ok(r);
  }
}

export async function pressEnter(interval: number[]) {
  // 生成pecmd脚本
  let script = "";
  for (const i of interval) {
    script += `WAIT ${i}000\nSEND VK_RETURN\n`;
  }
  // 写脚本
  const p = `${PROJECT_ROOT}/_press.wcs`;
  fs.writeFileSync(p, script);
  // 执行
  cp.execSync(`${wherePECMD().unwrap()} _press.wcs`, { cwd: PROJECT_ROOT });
  // 删除脚本
  fs.unlinkSync(p);
}

export function coverSecret(secret: string) {
  // 对半拆分密钥
  const cutPoint = Math.ceil(secret.length / 2);
  const o1 = secret.substring(0, cutPoint),
    o2 = secret.substring(cutPoint);

  // 分别遮掩尾和头
  const c1 = o1.substring(0, Math.ceil(o1.length * 0.3)).padEnd(o1.length, "*"),
    c2 = o2.substring(Math.ceil(o2.length * 0.6)).padStart(o2.length, "*");

  return c1 + c2;
}

export function parseFileSize(str: string = "512KB"): Result<number, string> {
  if (!str) {
    return new Err(
      `Error:Failed to parse '${str}' as valid file size : empty string provided, e.g. '512KB'`,
    );
  }

  const UNITS: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };

  const regex = /(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)/i;
  const match = str.match(regex);

  if (!match) {
    return new Err(
      `Error:Failed to parse '${str}' as valid file size : invalid file size format, e.g. '512KB'`,
    );
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  if (!UNITS[unit]) {
    return new Err(
      `Error:Failed to parse '${str}' as valid file size : unknown unit, e.g. '512KB'`,
    );
  }

  return new Ok(value * UNITS[unit]);
}

export function calcMD5(text: string) {
  const hash = createHash("md5");
  hash.update(text);
  return hash.digest("hex");
}

export function getCleanTaskName(raw: string) {
  return raw.includes("_") ? raw.split("_")[0] : raw;
}

export function formatUrl(rawUrl: string) {
  return rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;
}
