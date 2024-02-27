import * as fs from "fs";
import * as path from "path";
import { yellow } from "colors";

const deployDir = path.join(__dirname, "..", "..", "deployments");
function ensureDir(filepath: string) {
  if (!fs.lstatSync(path.dirname(filepath)).isDirectory()) {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
  }
}

export function loadNetConfig(netName: string): any {
  const netConfigPath = path.join(deployDir, netName, "config.json");
  ensureDir(netConfigPath);

  if (!fs.existsSync(netConfigPath)) {
    return {};
  }
  console.log(`load network config:`, yellow(netConfigPath));
  return JSON.parse(fs.readFileSync(netConfigPath).toString());
}

export function saveNetConfig(netName: string, newNetConfig: object) {
  const netConfigPath = path.join(deployDir, netName, "config.json");
  ensureDir(netConfigPath);

  console.log(`saved network config:`, yellow(netConfigPath));
  fs.writeFileSync(netConfigPath, JSON.stringify(newNetConfig, null, 2));
}
