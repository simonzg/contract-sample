import {
  Contract,
  BytesLike,
  Wallet,
  JsonRpcProvider,
  isBytesLike,
  isAddress,
  ZeroAddress,
  Interface,
} from "ethers";
import { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";
import { input, select, password, confirm } from "@inquirer/prompts";
import { enable, yellow, green, blue, red, bgBlack, bgWhite } from "colors";
enable();

import * as fs from "fs";
import * as path from "path";
import moment from "moment";

import hardhatConfig from "../../hardhat.config";
import { exit } from "process";
import {
  moveContractInfo,
  saveContractInfo,
  loadContractInfo,
  ContractInfo,
} from "./contractInfo";
import { loadNetConfig, saveNetConfig } from "./netConfig";

export * from "./contractInfo";
export * from "./netConfig";
export * from "./permit";

export const overrides: any = {
  gasLimit: 8000000,
};

export type Network = {
  name: string;
  provider: JsonRpcProvider;
  wallet: Wallet;
  override: any;
  netConfig: any;
  updateNetConfig: Function;
};

const deployDir = path.join(__dirname, "..", "deployments");
function ensureDir(filepath: string) {
  if (!fs.lstatSync(path.dirname(filepath)).isDirectory()) {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
  }
}

export function findContractPath(name: string): string {
  const q = [path.join(__dirname, "..", "contracts")];
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
      } else if (f == name + ".sol") {
        return (
          filepath.replace(path.join(__dirname, "..") + "/", "") + `:${name}`
        );
      }
    }
  }
  throw new Error(`没有找到合约 ${name} 的.sol文件`);
}

export function loadTokenMapping(network: Network, proxyAddress: string) {
  const { netConfig } = network;
  if (!netConfig.tokenMapping) {
    return {};
  }
  if (netConfig.tokenMapping[proxyAddress]) {
    return netConfig.tokenMapping[proxyAddress];
  }
  return {};
}

export function saveTokenMapping(
  network: Network,
  proxyAddress: string,
  tokenMapping: object
) {
  const { netConfig, updateNetConfig } = network;
  if (!netConfig.tokenMapping) {
    netConfig.tokenMapping = {};
  }
  netConfig.tokenMapping[proxyAddress] = tokenMapping;
  updateNetConfig(netConfig);
}

export function loadDeployedAddresses(
  network: Network,
  name: string,
  isProxy = false
): string[] {
  const { netConfig } = network;

  if (isProxy) {
    name += "-proxy";
  }
  let result = [];
  if (netConfig.hasOwnProperty(name)) {
    if (typeof netConfig[name] == "string") {
      result = [netConfig[name]];
    } else if (Array.isArray(netConfig[name])) {
      result = netConfig[name];
    }
  }
  return result;
}

export function saveDeployedAddress(
  network: Network,
  name: string,
  address: string,
  isProxy = false
) {
  if (isProxy) {
    name += "-proxy";
  }
  const { netConfig, updateNetConfig } = network;
  if (!netConfig[name]) {
    netConfig[name] = address;
  } else if (typeof netConfig[name] == "string" && netConfig[name] != address) {
    netConfig[name] = [address, netConfig[name]];
  } else if (Array.isArray(netConfig[name])) {
    netConfig[name].unshift(address);
  }
  updateNetConfig(netConfig);
}

export function getNetworkChoicesFromHardhat() {
  const networkChoices = Object.keys(hardhatConfig.networks).map((n) => ({
    name: `${n} (${
      hardhatConfig.networks[n as keyof typeof hardhatConfig.networks].chainId
    }) : ${
      hardhatConfig.networks[n as keyof typeof hardhatConfig.networks].url
    }`,
    value: n,
  }));
  return networkChoices;
}

export function getNetwork2LZMap() {
  let configMap: { [key: string]: any } = {};
  for (const network in hardhatConfig.networks) {
    const config = loadNetConfig(network);
    if (
      config.hasOwnProperty("lzEndpointId") &&
      config.hasOwnProperty("lzEndpoint")
    ) {
      configMap[network] = {
        lzEndpointId: config.lzEndpointId,
        lzEndpoint: config.lzEndpoint,
      };
    }
  }
  return configMap;
}

export function getLZ2NetworkMap() {
  const n2l = getNetwork2LZMap();
  let l2n: { [key: string]: string } = {};
  for (const netName in n2l) {
    l2n[n2l[netName].lzEndpointId] = netName;
  }
  return l2n;
}

export function getAllNetConfigs() {
  const networks = Object.keys(hardhatConfig.networks);
  let results = [];
  for (const network of networks) {
    const netConfig = loadNetConfig(network);
    results.push({
      ...netConfig,
      name: network,
      rpc: hardhatConfig.networks[
        network as keyof typeof hardhatConfig.networks
      ].url,
      chainId:
        hardhatConfig.networks[network as keyof typeof hardhatConfig.networks]
          .chainId,
    });
  }
  return results;
}

export async function selectProxyOFT(network: Network) {
  const v1Proxies = loadDeployedAddresses(network, "ProxyOFT", true);
  const v2Proxies = loadDeployedAddresses(network, "ProxyOFTV2", true);
  let choicesB: { name: string; value: string }[] = [];
  v1Proxies.map((p) => {
    choicesB.push({ name: `V1: ${p}`, value: p });
  });
  v2Proxies.map((p) => {
    choicesB.push({ name: `V2: ${p}`, value: p });
  });
  if (choicesB.length <= 0) {
    console.log(`${network.name} 上还没有部署任何ProxyOFT，请先部署`);
    exit(-1);
  }
  const proxyAddress = await select({
    message: `选择网络${green(network.name)}上ProxyOFT地址:`,
    choices: choicesB,
  });
  const version = v1Proxies.includes(proxyAddress) ? "v1" : "v2";
  return { address: proxyAddress, version };
}

export async function selectNetwork(
  name: string = "",
  readonly = false
): Promise<Network> {
  // const { config, configPath } = await setConfig();
  if (!fs.lstatSync(deployDir).isDirectory()) {
    fs.mkdirSync(deployDir);
  }

  let override: any = {};
  const netName = await select({
    message: `选择网络${green(name)}:`,
    choices: getNetworkChoicesFromHardhat(),
  });
  type StatusKey = keyof typeof hardhatConfig.networks;

  let netConfig = loadNetConfig(netName);
  netConfig.rpc = hardhatConfig.networks[netName as StatusKey].url;
  console.log(`使用 hardhat.config.ts 中配置的rpc: `, netConfig.rpc);

  const provider = new JsonRpcProvider(netConfig.rpc);
  let wallet = {} as Wallet;
  if (!readonly) {
    let privateKey = "";
    const env_privkey = process.env[`${netName.toUpperCase()}_PRIVKEY`];
    if (env_privkey && isBytesLike(env_privkey)) {
      privateKey = env_privkey;
    } else {
      privateKey = await password({
        message: `输入网络${green(name)}的Private Key:`,
        validate: (value = "") =>
          isBytesLike(value) || "Pass a valid Private Key value",
        mask: "*",
      });
    }

    wallet = new Wallet(privateKey, provider);
    console.log("Wallet Signer:", yellow(wallet.address));
  }

  const feeData = await provider.getFeeData();
  if (!readonly) {
    const defaultGasPrice = feeData.gasPrice;
    override.gasPrice = await input({
      message: "输入Gas price:",
      default: defaultGasPrice?.toString(),
      validate: (value = "") => value.length > 0 || "Pass a valid value",
    });
  }

  const updateNetConfig = (newNetConfig: object) => {
    saveNetConfig(netName, newNetConfig);
  };

  return {
    name: netName,
    provider,
    wallet,
    override,
    netConfig,
    updateNetConfig,
  };
}

export async function sendTransaction(
  network: Network,
  contract: any,
  func: string,
  args: any[],
  override: any = {},
  checkRole: BytesLike = "0x"
) {
  if (checkRole != "0x") {
    let hasRole = await contract.hasRole(checkRole, network.wallet.address);
    if (!hasRole) {
      throw new Error(red("签名人不具有DEFAULT_ADMIN_ROLE权限!"));
    }
  }
  const address = await contract.getAddress();
  override.nonce = await input({
    message: "输入nonce:",
    default: (
      await network.provider.getTransactionCount(network.wallet.address)
    ).toString(),
    validate: (value = "") => value.length > 0 || "Pass a valid value",
  });

  override.gasLimit = await contract[func].estimateGas(...args, override);
  console.log("Estimated Gas:", green(override.gasLimit.toString()));
  let response = await contract[func](...args, override);
  const receipt = await response.wait();
  console.log(
    `called ${blue(func)} at ${address} by tx:`,
    yellow(receipt.hash)
  );
}

export async function loadOrDeployImplContract(
  ethers: HardhatEthersHelpers,
  network: Network,
  contract: string,
  args: any[],
  override: any = {}
): Promise<Contract> {
  const deployedAddresses = loadDeployedAddresses(network, contract);
  if (deployedAddresses.length > 0) {
    const redeploy = await confirm({
      message: `${contract} Impl合约已部署至${deployedAddresses[0]}等${deployedAddresses.length}个地址，需要重新部署吗？ `,
      default: false,
    });
    if (redeploy) {
      moveContractInfo(network.name, contract);
    } else {
      const address = await input({
        message: `输入${contract} Impl合约地址`,
        default: deployedAddresses[0],
        validate: (value = "") =>
          isAddress(value) || "Pass a valid address value",
      });
      return ethers.getContractAt(contract, address, network.wallet);
    }
  }

  return deployContractV2(ethers, network, contract, args, override);
}

export async function loadOrDeployProxyContract(
  ethers: HardhatEthersHelpers,
  network: Network,
  implContractName: string,
  implAddr: string,
  buildData: (network: Network, _interface: Interface) => Promise<string>,
  override: any = {}
): Promise<Contract> {
  const { netConfig, updateNetConfig } = network;
  const deployedAddresses = loadDeployedAddresses(
    network,
    implContractName,
    true
  );
  if (deployedAddresses.length > 0) {
    const redeploy = await confirm({
      message: `${implContractName} Proxy合约已部署至${deployedAddresses[0]}等${deployedAddresses.length}个地址，需要重新部署吗？`,
      default: false,
    });
    if (redeploy) {
      moveContractInfo(network.name, implContractName, true);
    } else {
      const address = await input({
        message: `确认${implContractName} Proxy合约地址`,
        default: deployedAddresses[0],
        validate: (value = "") =>
          isAddress(value) || "Pass a valid address value",
      });
      return ethers.getContractAt(
        "TransparentUpgradeableProxy",
        address,
        network.wallet
      );
    }
  }

  const proxyAdmin = await input({
    message: "输入ProxyAdmin地址:",
    default: netConfig.proxyAdmin,
    validate: (value = "") => isAddress(value) || "Pass a valid address value",
  });
  netConfig.proxyAdmin = proxyAdmin;
  updateNetConfig(netConfig);

  const implContract = await ethers.getContractAt(
    implContractName,
    ZeroAddress
  );
  const data = await buildData(network, implContract.interface);
  return deployContractV2(
    ethers,
    network,
    "TransparentUpgradeableProxy",
    [implAddr, proxyAdmin, data],
    override,
    `${implContractName}-proxy`
  );
}

export async function deployContractV2(
  ethers: HardhatEthersHelpers,
  network: Network,
  contract: string,
  args: any[],
  override: any = {},
  alias = ""
): Promise<Contract> {
  const { netConfig, updateNetConfig } = network;
  override.nonce = await input({
    message: `准备部署${contract}，输入nonce:`,
    default: (
      await network.provider.getTransactionCount(network.wallet.address)
    ).toString(),
    validate: (value = "") => value.length > 0 || "Pass a valid value",
  });

  moveContractInfo(network.name, contract);

  const factory = await ethers.getContractFactory(contract, network.wallet);
  const deployTx = await factory.getDeployTransaction(...args);
  override.gasLimit = await network.wallet.estimateGas(deployTx);
  console.log("Estimated Gas:", green(override.gasLimit.toString()));

  const constructorFragment = factory.interface.deploy;
  const constructorArgumentsDefs = constructorFragment.inputs.map((f) => ({
    name: f.name,
    type: f.type,
  }));
  const deploy = await factory.deploy(...args, override);
  const deployed = await deploy.waitForDeployment();

  const address = await deployed.getAddress();
  const response = await deployed.deploymentTransaction();
  const tx = await response?.getTransaction();

  console.log(
    `${contract} deployed on ${green(network.name)} at: ${yellow(address)}`
  );
  const info: ContractInfo = {
    contract,
    address,
    createdBy: network.wallet.address,
    createdAt: moment().format(),
    creationTx: tx?.hash,
    constructorArguments: args,
    constructorArgumentsDefs,
  };
  let key = contract;
  if (alias) {
    key = alias;
    saveContractInfo(network.name, alias, info);
  } else {
    saveContractInfo(network.name, contract, info);
  }
  saveDeployedAddress(network, key, info.address);
  return deployed;
}

export async function getContractReadOnly(
  ethers: HardhatEthersHelpers,
  rpc: string,
  contract: string,
  address: string
) {
  const provider = new JsonRpcProvider(rpc);

  return await ethers.getContractAt(contract, address);
}

export async function loadContractV2(
  ethers: HardhatEthersHelpers,
  network: Network,
  contract: string
) {
  const info = loadContractInfo(network.name, contract);

  if (info.address != "") {
    return await ethers.getContractAt(contract, info.address, network.wallet);
  }
  return null;
}
