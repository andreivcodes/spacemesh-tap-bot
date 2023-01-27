import { Message, Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import { config } from "dotenv";
import {
  submitTransaction,
  createGlobalStateClient,
  createMeshClient,
  createTransactionClient,
  derivePrivateKey,
  derivePublicKey,
  toHexString,
  AccountDataFlag,
  SubmitTransactionResponse,
} from "@andreivcodes/spacemeshlib";
import crypto from "crypto";
import pkg from "@spacemesh/sm-codec";
import Bech32 from "@spacemesh/address-wasm";
import { sha256 } from "@spacemesh/sm-codec/lib/utils/crypto.js";

(async () => {
  Bech32.default.init();
  Bech32.default.setHRPNetwork("smtest");
})();

const { SingleSigTemplate, TemplateRegistry } = pkg;

config();

//https://discord.com/api/oauth2/authorize?client_id=1006876873139163176&permissions=1088&scope=bot

const SEED: string = process.env.SEEDPHRASE!;
let url = "https://discover.spacemesh.io/networks.json";
let networkUrl: string;

async function main() {
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
  let sk = (await derivePrivateKey(SEED, 0)) as Uint8Array;
  let pk = (await derivePublicKey(SEED, 0)) as Uint8Array;

  console.log(`Connecting to ${networkUrl}:443`);

  const globalStateClient = createGlobalStateClient(networkUrl, 443, true);
  const meshClient = createMeshClient(networkUrl, 443, true);
  const txClient = createTransactionClient(networkUrl, 443, true);

  const accountQueryResponse = await globalStateClient.accountDataQuery({
    filter: {
      accountId: {
        address: "stest1qqqqqqq4ah6ncerdv5k78kclmpkaaxupaly9yrq4r4863",
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
    `Tap currently running on address 0x${toHexString(
      pk
    )} with nonce ${accountNonce} and has a balance of ${accountBalance} SMD`
  );

  if (Number(accountNonce) == 0) {
    message.reply(`My counter is 0... is this the first transaction?`);
  }
  if (Number(accountBalance) < amount) {
    message.reply(`I am out of funds :(`);
    return;
  }

  const tpl = TemplateRegistry.get(SingleSigTemplate.key, 1);
  const principal = tpl.principal({
    PublicKey: Bech32.default.parse(
      "stest1qqqqqqq4ah6ncerdv5k78kclmpkaaxupaly9yrq4r4863",
      "stest"
    ),
  });

  const payload = {
    Arguments: {
      Destination: Bech32.default.parse(to, "stest"),
      Amount: BigInt(amount),
    },
    Nonce: {
      Counter: BigInt(accountNonce),
      Bitfield: BigInt(0),
    },
    GasPrice: BigInt(1),
  };

  const txEncoded = tpl.encode(principal, payload);
  const genesisID = await (await meshClient.genesisID({})).genesisId;
  const hashed = sha256(new Uint8Array([...genesisID, ...txEncoded]));
  const sig = sign(hashed, toHexString(sk));

  console.log(txEncoded);
  console.log(sig);
  const signed = tpl.sign(txEncoded, sig);

  txClient
    .submitTransaction({ transaction: signed })
    .then((response: SubmitTransactionResponse) => {
      message.reply(
        `just 💸  transferred funds to ${
          message.content
        }. \nTx ID: 0x${toHexString(response.txstate?.id?.id!)}`
      );
      console.log(
        `just 💸  transferred funds to ${
          message.content
        }. \nTx ID: 0x${toHexString(response.txstate?.id?.id!)}`
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
