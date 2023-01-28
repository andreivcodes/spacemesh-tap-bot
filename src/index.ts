import { Message, Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import { config } from "dotenv";
import crypto from "crypto";
import pkg from "@spacemesh/sm-codec";
import Bech32 from "@spacemesh/address-wasm";
import { sha256 } from "@spacemesh/sm-codec/lib/utils/crypto.js";
import { ChannelCredentials, createChannel, createClient } from "nice-grpc";
import {
  AccountDataFlag,
  SubmitTransactionResponse,
  toHexString,
  GlobalStateServiceDefinition,
  MeshServiceDefinition,
  TransactionServiceDefinition,
  file,
  generateKeyPair,
} from "@andreivcodes/spacemeshlib";

import "./wasm_exec.js";

const loadwasm = async () => {
  // @ts-ignore
  const go = new Go(); // eslint-disable-line no-undef
  // @ts-ignore
  const { instance } = await WebAssembly.instantiate(
    Buffer.from(file),
    go.importObject
  );
  go.run(instance);
  console.log("wasm loaded");
};

(async () => {
  Bech32.default.init();
  Bech32.default.setHRPNetwork("stest");
})();

const { SingleSigTemplate, TemplateRegistry } = pkg;

config();

//https://discord.com/api/oauth2/authorize?client_id=1006876873139163176&permissions=1088&scope=bot

const SEED: string = process.env.SEEDPHRASE!;
let url = "https://discover.spacemesh.io/networks.json";
let networkUrl: string;

async function main() {
  loadwasm();
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once("ready", () => {
    console.log("Ready!");
  });

  client.on("messageCreate", async (message: any) => {
    //our special channel
    if (message.channel.name == "🏦tap" || message.channel.name == "tap") {
      try {
        if (message.member.displayName != "spacemesh-tap-bot") {
          await getNetwork();
          let address = message.content as string;
          await sendSmesh({ to: address, amount: 100, message: message });
        }
      } catch (e) {
        console.log(e);
      }
    }
  });

  client.login(process.env.TOKEN!);
}

async function getNetwork() {
  await fetch(url)
    .then((response) => response.json())
    .then((res: any) => {
      networkUrl = res[0]["grpcAPI"].slice(0, -1).substring(8);
    });
}

async function sendSmesh({
  to,
  amount,
  message,
}: {
  to: string;
  amount: number;
  message: Message;
}) {
  console.log(`Connecting to ${networkUrl}:443`);

  const { publicKey, secretKey } = await generateKeyPair(SEED, 0);

  const tpl = TemplateRegistry.get(SingleSigTemplate.key, 1);
  const principal = tpl.principal({
    PublicKey: publicKey,
  });

  const address = Bech32.default.generateAddress(principal);

  const channel = createChannel(
    `${networkUrl}:${443}`,
    ChannelCredentials.createSsl()
  );
  const globalStateClient = createClient(GlobalStateServiceDefinition, channel);
  const meshClient = createClient(MeshServiceDefinition, channel);
  const txClient = createClient(TransactionServiceDefinition, channel);

  const accountQueryResponse = await globalStateClient.accountDataQuery({
    filter: {
      accountId: {
        address: address,
      },
      accountDataFlags: AccountDataFlag.ACCOUNT_DATA_FLAG_ACCOUNT,
    },
    maxResults: 1,
    offset: 0,
  });

  let accountNonce = Number(
    accountQueryResponse.accountItem[0].accountWrapper?.stateProjected?.counter
  );
  let accountBalance = Number(
    accountQueryResponse.accountItem[0].accountWrapper?.stateProjected?.balance
      ?.value
  );

  console.log(
    `Tap currently running on address ${address} with nonce ${accountNonce} and has a balance of ${accountBalance} SMD`
  );

  if (Number(accountNonce) == 0) {
    message.reply(`My counter is 0... is this the first transaction?`);
  }
  if (Number(accountBalance) < amount) {
    message.reply(`I am out of funds :(`);
    return;
  }

  const payload = {
    Arguments: {
      Destination: Bech32.default.parse(to),
      Amount: BigInt(amount),
    },
    Nonce: {
      Counter: BigInt(accountNonce),
      Bitfield: BigInt(0),
    },
    GasPrice: BigInt(500),
  };

  const txEncoded = tpl.encode(principal, payload);
  const genesisID = await (await meshClient.genesisID({})).genesisId;
  const hashed = sha256(new Uint8Array([...genesisID, ...txEncoded]));
  const sig = sign(hashed, toHexString(secretKey));
  const signed = tpl.sign(txEncoded, sig);

  txClient
    .submitTransaction({ transaction: signed })
    .then((response: SubmitTransactionResponse) => {
      message.reply(
        `just 💸  transferred funds to ${
          message.content
        }. \nTx ID: 0x${toHexString(response.txstate?.id?.id!)}
     `
      );
      console.log(
        `just 💸  transferred funds to ${
          message.content
        }. \nTx ID: 0x${toHexString(response.txstate?.id?.id!)}
      `
      );
    })
    .catch((err: any) => {
      message.reply(`could not transfer :( submitTransaction failed`);
      console.log(err);
    });
}

export const sign = (dataBytes: Uint8Array, privateKey: string) => {
  const key = Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"), // DER privateKey prefix for ED25519
    Buffer.from(privateKey, "hex"),
  ]);
  const pk = crypto.createPrivateKey({
    format: "der",
    type: "pkcs8",
    key,
  });
  return Uint8Array.from(crypto.sign(null, dataBytes, pk));
};

main();
