import "@typechain/hardhat";
import "@nomicfoundation/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-verify";
import { config } from "dotenv";
config();

// const { setGlobalDispatcher, ProxyAgent } = require("undici");
// const proxyAgent = new ProxyAgent("http://127.0.0.1:7890");
// setGlobalDispatcher(proxyAgent);

function compileSetting(version: string, runs: number) {
  return {
    version: version,
    settings: {
      optimizer: {
        enabled: true,
        runs: runs,
      },
      outputSelection: {
        "*": {
          "*": [
            "abi",
            "evm.bytecode",
            "evm.deployedBytecode",
            "evm.methodIdentifiers",
            "metadata",
            "storageLayout",
          ],
          "": ["ast"],
        },
      },
    },
  };
}

export default {
  networks: {
    metertest: {
      url: `https://rpctest.meter.io`,
      chainId: 83,
      gasPrice: 500000000000,
    },
    meterstage: {
      url: `http://rpc-stage.meter.io`,
      chainId: 82,
      gasPrice: 500000000000,
    },
    metermain: {
      url: `https://rpc.meter.io`,
      chainId: 82,
      gasPrice: 500000000000,
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      chainId: 11155111,
      gasPrice: 4000000000000,
    },
    ethereum: {
      url: "https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161", // public infura endpoint
      chainId: 1,
      gasPrice: 4000000000000,
    },
    basetest: {
      url: `https://goerli.base.org`,
      chainId: 84531,
    },
    basemain: {
      url: `https://base.publicnode.com`,
      chainId: 8453,
    },
    arbitrum: {
      url: `https://arb1.arbitrum.io/rpc`,
      chainId: 42161,
    },
  },
  etherscan: {
    apiKey: {
      basemain: process.env.BASESCAN_API_KEY,
      ethereum: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
      sepolia: process.env.ETHERSCAN_API_KEY,
      arbitrum: process.env.ARBISCAN_API_KEY,
    },
    customChains: [
      {
        network: "arbitrum",
        chainId: 42161,
        urls: {
          apiURL: `https://api.arbiscan.io/api`,
          browserURL: "https://arbiscan.io/",
        },
      },
      {
        network: "goerli",
        chainId: 5,
        urls: {
          apiURL: `https://api-goerli.etherscan.io/api`,
          browserURL: "https://goerli.etherscan.io",
        },
      },
      {
        network: "basemain",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
    ],
  },
  solidity: {
    compilers: [compileSetting("0.8.19", 200)],
  },
  mocha: {
    timeout: 200000,
  },
};
