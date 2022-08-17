import { createChannel, createClient, ChannelCredentials } from "nice-grpc";
import {
  GlobalStateServiceClient,
  GlobalStateServiceDefinition,
} from "./proto/gen/spacemesh/v1/global_state";
import {
  AccountDataFilter,
  AccountDataFlag,
  AccountDataQueryRequest,
  AccountDataQueryResponse,
} from "./proto/gen/spacemesh/v1/global_state_types";
import {
  TransactionServiceClient,
  TransactionServiceDefinition,
} from "./proto/gen/spacemesh/v1/tx";
import { AccountId } from "./proto/gen/spacemesh/v1/types";
import { mnemonicToSeedSync } from "bip39";
import { loadWasm, signTransaction, toHexString } from "./util";
const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

//https://discord.com/api/oauth2/authorize?client_id=1006876873139163176&permissions=1088&scope=bot

const channel = createChannel(
  "api-devnet225.spacemesh.io:443",
  ChannelCredentials.createSsl()
);

const senderSeed: string = process.env.SEEDPHRASE!;

function main() {
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
        let address = (message.content as string).slice(2);
        console.log(message.content);
        await sendSmesh({ to: address, amount: 42069 });
        message.reply(`just 💸  transferred funds to ${message.content}`);
      } catch (e) {
        console.log(e);
      }
    }
  });

  client.login(process.env.TOKEN!);
}

async function sendSmesh({ to, amount }: { to: string; amount: number }) {
  const senderPrivateKey = mnemonicToSeedSync(senderSeed);

  const slicedSenderPrivateKey = new Uint8Array(senderPrivateKey.slice(32));

  const enc = new TextEncoder();
  const saltAsUint8Array = enc.encode("Spacemesh blockmesh");
  let publicKey = new Uint8Array(32);
  let secretKey = new Uint8Array(64);

  const crypto = require("crypto");
  globalThis.crypto = {
    // @ts-ignore
    getRandomValues(b) {
      crypto.randomFillSync(b);
    },
  };
  require("./wasm_exec");

  await loadWasm("./src/ed25519.wasm")
    .then((wasm) => {
      secretKey =
        // @ts-ignore
        __deriveNewKeyPair(slicedSenderPrivateKey, 0, saltAsUint8Array);
      publicKey = secretKey.slice(32);
    })
    .catch((error) => {
      console.log("ouch", error);
    });

  const accountClient: GlobalStateServiceClient = createClient(
    GlobalStateServiceDefinition,
    channel
  );

  const accountQueryId: AccountId = { address: publicKey };

  const accountQueryFilter: AccountDataFilter = {
    accountId: accountQueryId,
    accountDataFlags: AccountDataFlag.ACCOUNT_DATA_FLAG_ACCOUNT,
  };

  const accountQuery: AccountDataQueryRequest = {
    filter: accountQueryFilter,
    maxResults: 1,
    offset: 0,
  };

  let accountQueryResponse: AccountDataQueryResponse =
    await accountClient.accountDataQuery(accountQuery);

  let senderAccountNonce =
    accountQueryResponse.accountItem[0].accountWrapper?.stateProjected?.counter;

  let tx = await signTransaction({
    accountNonce: senderAccountNonce!,
    receiver: to,
    price: 1,
    amount: amount,
    secretKey: toHexString(secretKey),
  });

  console.log("tx: " + toHexString(tx));

  const transactionClient: TransactionServiceClient = createClient(
    TransactionServiceDefinition,
    channel
  );

  transactionClient.submitTransaction({ transaction: tx as Uint8Array });
}

main();
