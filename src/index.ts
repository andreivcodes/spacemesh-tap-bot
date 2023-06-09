import { Message, Client, GatewayIntentBits, ChannelType } from "discord.js";
import fetch from "node-fetch";
import { config } from "dotenv";
import crypto from "crypto";
import Bech32 from "@spacemesh/address-wasm";
import pkg from "@spacemesh/sm-codec";
import { derive_key } from "@spacemesh/ed25519-bip32";
import { ChannelCredentials, createChannel, createClient } from "nice-grpc";
import * as bip39 from "bip39";
import {
  AccountDataFlag,
  SubmitTransactionResponse,
  toHexString,
  GlobalStateServiceDefinition,
  MeshServiceDefinition,
  TransactionServiceDefinition,
  file,
  fromHexString,
  TransactionState_TransactionState,
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

config();

//https://discord.com/api/oauth2/authorize?client_id=1006876873139163176&permissions=1088&scope=bot

const SEED: string = process.env.SEEDPHRASE!;

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

  let rateLimit = new Map<string, Date>();

  client.on("messageCreate", async (message: Message) => {
    //our special channel
    if (
      message.channel.type == ChannelType.GuildText &&
      message.member &&
      message.member.displayName != "spacemesh-tap-bot" &&
      message.channel.name == "🏦tap"
    ) {
      // try {
      if (message.content.length == 51 && message.content.includes("stest")) {
        let address = message.content as string;
        const currentDate = new Date();
        const userLastActionDate = rateLimit.get(message.author.username);

        if (userLastActionDate) {
          const differenceInMilliseconds =
            currentDate.getTime() - userLastActionDate.getTime();
          const differenceInHours = differenceInMilliseconds / (1000 * 60 * 60);

          if (differenceInHours > 12) {
            await sendSmesh({ to: address, amount: 2000000, message: message });
            rateLimit.set(message.author.username, new Date());
          } else {
            message.react("👎");
            message.reply(
              `Slow down... ${(12 - differenceInHours).toFixed(0)}h remaining`
            );
          }
        } else {
          await sendSmesh({ to: address, amount: 2000000, message: message });
          rateLimit.set(message.author.username, new Date());
        }
      } else if (
        message.content.length == 66 &&
        message.content.includes("0x")
      ) {
        let txid = message.content as string;
        await checkTx({ tx: txid, message: message });
      } else
        message.reply(
          "Give me an address and I'll send you 100 smidge, or give me a txid and I'll tell you the state of the transaction."
        );
      // } catch (e) {
      //   message.reply(`Something went wrong. Try again later. \n ${e}`);
      // }
    }
  });

  client.login(process.env.TOKEN!);
}

async function getNetwork() {
  const res = await fetch("https://discover.spacemesh.io/networks.json")
    .then((response) => response.json())
    .then((res: any) => {
      return res[0]["grpcAPI"].slice(0, -1).substring(8);
    });

  return res;
}

const checkTx = async ({ tx, message }: { tx: string; message: Message }) => {
  const networkUrl = await getNetwork();
  const channel = createChannel(
    `${networkUrl}:${443}`,
    ChannelCredentials.createSsl()
  );
  const txClient = createClient(TransactionServiceDefinition, channel);

  txClient
    .transactionsState({
      transactionId: [{ id: fromHexString(tx.substring(2)) }],
    })
    .then((res) => {
      switch (res.transactionsState[0].state) {
        case TransactionState_TransactionState.TRANSACTION_STATE_UNSPECIFIED:
          message.reply(`❓ Transaction state is unspecified.`);
          break;
        case TransactionState_TransactionState.TRANSACTION_STATE_REJECTED:
          message.reply(`🚫 Transaction is rejected.`);
          break;
        case TransactionState_TransactionState.TRANSACTION_STATE_INSUFFICIENT_FUNDS:
          message.reply(
            `💸 Transaction is rejected due to insufficient funds.`
          );
          break;
        case TransactionState_TransactionState.TRANSACTION_STATE_CONFLICTING:
          message.reply(`🚫 Transaction is conflicting.`);
          break;
        case TransactionState_TransactionState.TRANSACTION_STATE_MEMPOOL:
          message.reply(
            `⏳ Transaction is in mempool. Should be picked up for execution soon.`
          );
          break;
        case TransactionState_TransactionState.TRANSACTION_STATE_MESH:
          message.reply(`🚀 Transaction is in mesh. Should be executed soon.`);
          break;
        case TransactionState_TransactionState.TRANSACTION_STATE_PROCESSED:
          message.reply(`✅ Transaction is processed.`);
          break;
        case TransactionState_TransactionState.UNRECOGNIZED:
          message.reply(`❓ Transaction is unrecognized.`);
          break;
        default:
          message.reply(`Idk lol`);
          break;
      }
    });
};

const COIN_TYPE = 540;
const BIP_PROPOSAL = 44;
const path = `m/${BIP_PROPOSAL}'/${COIN_TYPE}'/0'/0'/${0}'`;

const sendSmesh = async ({
  to,
  amount,
  message,
}: {
  to: string;
  amount: number;
  message: Message;
}) => {
  const networkUrl = await getNetwork();

  const seed = bip39.mnemonicToSeedSync(SEED);

  const p0 = await derive_key(seed, path);
  const publicKey = p0.slice(32);
  const secretKey = p0;

  const tpl = pkg.TemplateRegistry.get(pkg.SingleSigTemplate.key, 16);
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

  if (Number(accountBalance) < amount) {
    message.reply(`I am out of funds :( send me some SMH here: **${address}**`);
    return;
  }

  const payload = {
    Arguments: {
      Destination: Bech32.default.parse(to),
      Amount: BigInt(amount),
    },
    Nonce: BigInt(accountNonce),
    GasPrice: BigInt(500),
  };

  console.log(payload);

  const encodedTx = tpl.encode(principal, payload);
  const genesisID = await (await meshClient.genesisID({})).genesisId;
  const sig = sign(
    new Uint8Array([...genesisID, ...encodedTx]),
    toHexString(secretKey)
  );
  const signed = tpl.sign(encodedTx, sig);

  txClient
    .submitTransaction({ transaction: signed })
    .then((response: SubmitTransactionResponse) => {
      message.reply(
        `just 💸  transferred funds to ${
          message.content
        }. \nTx ID: 0x${toHexString(response.txstate?.id?.id!)}`
      );
      message.react("👍");
    })
    .catch((err: any) => {
      message.reply(`could not transfer :( submitTransaction failed`);
      console.log(err);
    });
};

const sign = (dataBytes: Uint8Array, privateKey: string) => {
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
