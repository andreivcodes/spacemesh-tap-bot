import {
  createChannel,
  createClient,
  ChannelCredentials,
  Channel,
} from "nice-grpc";
import { Message } from "discord.js";
import fetch from "node-fetch";
import {
  GlobalStateServiceClient,
  GlobalStateServiceDefinition,
} from "@andreivcodes/spacemeshlib/lib/src/proto/dist/spacemesh/v1/global_state";
import {
  AccountDataFilter,
  AccountDataFlag,
  AccountDataQueryRequest,
  AccountDataQueryResponse,
} from "@andreivcodes/spacemeshlib/lib/src/proto/dist/spacemesh/v1/global_state_types";
import {
  TransactionServiceClient,
  TransactionServiceDefinition,
} from "@andreivcodes/spacemeshlib/lib/src/proto/dist/spacemesh/v1/tx";
import { SubmitTransactionResponse } from "@andreivcodes/spacemeshlib/lib/src/proto/dist/spacemesh/v1/tx_types";
import { AccountId } from "@andreivcodes/spacemeshlib/lib/src/proto/dist/spacemesh/v1/types";
import {
  derivePublicKey,
  toHexString,
  derivePrivateKey,
  signTransaction,
} from "@andreivcodes/spacemeshlib/lib/src/util";
const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

//https://discord.com/api/oauth2/authorize?client_id=1006876873139163176&permissions=1088&scope=bot

const senderSeed: string = process.env.SEEDPHRASE!;
let url = "https://discover.spacemesh.io/networks.json";
let networkUrl: String;
let channel: Channel;

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
          let address = (message.content as string).slice(2);
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
      channel = createChannel(
        `${networkUrl}:443`,
        ChannelCredentials.createSsl()
      );
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
  let sk = (await derivePrivateKey(senderSeed, 0)) as Uint8Array;
  let pk = (await derivePublicKey(senderSeed, 0)) as Uint8Array;

  channel = createChannel(`${networkUrl}:443`, ChannelCredentials.createSsl());

  console.log(`Connecting to ${networkUrl}:443`);
  const accountClient: GlobalStateServiceClient = createClient(
    GlobalStateServiceDefinition,
    channel
  );

  const accountQueryId: AccountId = { address: pk };

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
    .then(async (result: AccountDataQueryResponse) => {
      console.log(result.accountItem[0].accountWrapper);
      let senderAccountNonce =
        result.accountItem[0].accountWrapper?.stateProjected?.counter;

      let senderAccountBalance =
        result.accountItem[0].accountWrapper?.stateProjected?.balance?.value;

      console.log(
        `Tap currently running on address 0x${toHexString(
          pk
        )} with nonce ${senderAccountNonce} and has a balance of ${senderAccountBalance} SMD`
      );

      if (Number(senderAccountNonce) == 0) {
        message.reply(`My counter is 0... is this the first transaction?`);
        return;
      }
      if (Number(senderAccountBalance) < amount) {
        message.reply(`I am out of funds :(`);
        return;
      }

      let tx = await signTransaction({
        accountNonce: Number(senderAccountNonce),
        receiver: to,
        gasLimit: 1,
        fee: 1,
        amount: amount,
        secretKey: toHexString(sk),
      });

      const transactionClient: TransactionServiceClient = createClient(
        TransactionServiceDefinition,
        channel
      );

      transactionClient
        .submitTransaction({
          transaction: tx as Uint8Array,
        })
        .then((response: SubmitTransactionResponse) => {
          if (response.status?.code == 0) {
            message.reply(
              `just 💸  transferred funds to ${
                message.content
              }. Tx ID: ${toHexString(response.txstate?.id?.id!)}`
            );
            console.log(
              `just 💸  transferred funds to ${
                message.content
              }. Tx ID: ${toHexString(response.txstate?.id?.id!)}`
            );
          } else
            message.reply(
              `could not transfer :( ${JSON.stringify(response.status)}`
            );
        })
        .catch((e: any) => {
          message.reply(`could not transfer :( submitTransaction failed`);
          console.log(e);
        });
    })
    .catch((e: any) => {
      message.reply(`could not transfer :( accountDataQuery failed`);
      console.log(e);
    });
}

main();
