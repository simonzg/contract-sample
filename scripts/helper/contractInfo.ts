import * as fs from "fs";
import * as path from "path";
import { yellow } from "colors";

export type ContractInfo = {
  contract: string;
  address: string;
  createdBy: string;
  createdAt: string;
  creationTx?: string;
  constructorArguments: Array<string>;
  constructorArgumentsDefs?: Array<{ name: string; type: string }>;
  libraries?: Object;
};

const deployDir = path.join(__dirname, "..", "..", "deployments");
function ensureDir(filepath: string) {
  if (!fs.lstatSync(path.dirname(filepath)).isDirectory()) {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
  }
}

function getContractInfoFilePath(
  network: string,
  contractName: string,
  isProxy = false
): string {
  let filepath = path.join(deployDir, network, `${contractName}.json`);
  if (isProxy) {
    filepath = path.join(deployDir, network, `${contractName}-proxy.json`);
  }
  ensureDir(filepath);
  return filepath;
}

export function saveContractInfo(
  network: string,
  contractName: string,
  info: ContractInfo,
  isProxy = false
) {
  let filepath = getContractInfoFilePath(network, contractName, isProxy);

  fs.writeFileSync(filepath, JSON.stringify(info, null, 2));
  console.log(`saved contract info:`, yellow(filepath));
}

export function loadContractInfo(
  network: string,
  contractName: string,
  isProxy = false
): ContractInfo {
  let filepath = getContractInfoFilePath(network, contractName, isProxy);

  if (fs.existsSync(filepath)) {
    return JSON.parse(fs.readFileSync(filepath).toString()) as ContractInfo;
  }
  console.log(`load contract info:`, yellow(filepath));
  return {} as ContractInfo;
}

export function loadContractInfoByAddress(
  network: string,
  address: string
): ContractInfo {
  const q = [path.join(deployDir, network)];
  while (q.length > 0) {
    const dir = q.shift();
    if (!dir) {
      continue;
    }
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const filepath = path.join(dir, f);
      if (fs.lstatSync(filepath).isDirectory()) {
        q.push(filepath);
      } else if (f.endsWith(".json")) {
        const content = JSON.parse(fs.readFileSync(filepath).toString());
        if (content.address.toLowerCase() == address.toLowerCase()) {
          return content as ContractInfo;
        }
      }
    }
  }
  throw new Error(`没有找到对应地址 ${address} 的配置`);
}

export function moveContractInfo(
  network: string,
  contractName: string,
  isProxy = false
) {
  const filepath = getContractInfoFilePath(network, contractName, isProxy);

  if (!fs.existsSync(filepath)) {
    return;
  }

  const content: ContractInfo = JSON.parse(
    fs.readFileSync(filepath).toString()
  );

  if (!content.address) {
    return;
  }

  const filename = path.basename(filepath);
  const ext = path.extname(filename);
  const realname = filename.slice(0, filename.length - ext.length);
  const newname = realname + "-" + content.address + ext;
  const newpath = path.join(deployDir, network, newname);
  console.log(`moved contract info: ${filepath} -> ${yellow(newpath)}`);
  fs.writeFileSync(newpath, JSON.stringify(content, null, 2));
  fs.unlinkSync(filepath);
}
