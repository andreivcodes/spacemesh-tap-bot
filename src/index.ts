import {
  createChannel,
  createClient,
  ChannelCredentials,
  Channel,
} from "nice-grpc";
import {
  GlobalStateServiceClient,
  GlobalStateServiceDefinition,
} from "./proto/gen/spacemesh/v1/global_state";
import {
  AccountDataFilter,
  AccountDataFlag,
  AccountDataQueryRequest,
} from "./proto/gen/spacemesh/v1/global_state_types";
import {
  TransactionServiceClient,
  TransactionServiceDefinition,
} from "./proto/gen/spacemesh/v1/tx";
import { AccountId } from "./proto/gen/spacemesh/v1/types";
import { mnemonicToSeedSync } from "bip39";
import { loadWasm, signTransaction, toHexString } from "./util";
import { Message } from "discord.js";
const { Client, GatewayIntentBits } = require("discord.js");
const request = require("request");
require("dotenv").config();

//https://discord.com/api/oauth2/authorize?client_id=1006876873139163176&permissions=1088&scope=bot

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
        if (message.member.displayName != "spacemesh-tap-bot") {
          let address = (message.content as string).slice(2);
          await sendSmesh({ to: address, amount: 1000, message: message });
        }
      } catch (e) {
        console.log(e);
      }
    }
  });

  client.login(process.env.TOKEN!);
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

  let url = "https://discover.spacemesh.io/networks.json";
  let options = { json: true };
  let networkUrl: String;
  let channel: Channel;

  request(
    url,
    options,
    async (
      error: any,
      res: { statusCode: number; body: { [x: string]: string }[] },
      body: any
    ) => {
      if (error) {
        console.log(error);
        message.reply(`could not transfer :(`);
      }

      try {
        if (!error && res.statusCode == 200) {
          networkUrl = res.body[0]["grpcAPI"].slice(0, -1).substring(8);
        }
      } catch (e) {
        console.log(e);
        message.reply(`could not transfer :(`);
      }

      channel = createChannel(
        `${networkUrl}:443`,
        ChannelCredentials.createSsl()
      );

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

      await accountClient
        .accountDataQuery(accountQuery)
        .then(async (result) => {
          let senderAccountNonce =
            result.accountItem[0].accountWrapper?.stateProjected?.counter;

          let tx = await signTransaction({
            accountNonce: senderAccountNonce ?? 0,
            receiver: to,
            price: 1,
            amount: amount,
            secretKey: toHexString(secretKey),
          });

          const transactionClient: TransactionServiceClient = createClient(
            TransactionServiceDefinition,
            channel
          );

          transactionClient
            .submitTransaction({
              transaction: tx as Uint8Array,
            })
            .then((result) => {
              if (result.status?.code == 0) {
                message.reply(
                  `just 💸  transferred funds to ${message.content}`
                );
              } else message.reply(`could not transfer :(`);
            })
            .catch((e) => {
              console.log(e);
            });
        })
        .catch((e) => {
          console.log(e);
        });
    }
  );
}

main();
