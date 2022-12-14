import { Message, Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import {
  toHexString,
  derivePrivateKey,
  derivePublicKey,
  getAccountBalance,
  getAccountNonce,
  submitTransaction,
  createClients,
  SubmitTransactionResponse,
} from "@andreivcodes/spacemeshlib";
import { config } from "dotenv";
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

  createClients(networkUrl, 443, true);

  let accountNonce = await getAccountNonce(pk);
  let accountBalance = await getAccountBalance(pk);

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

  submitTransaction({
    accountNonce: accountNonce,
    receiver: to,
    gasLimit: 1,
    fee: 1,
    amount: 100,
    secretKey: sk,
  })
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

main();
