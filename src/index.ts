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
  GlobalStateHashRequest,
} from "./proto/gen/spacemesh/v1/global_state_types";
import {
  TransactionServiceClient,
  TransactionServiceDefinition,
} from "./proto/gen/spacemesh/v1/tx";
import { AccountId } from "./proto/gen/spacemesh/v1/types";
import { mnemonicToSeedSync } from "bip39";
const { Client, GatewayIntentBits } = require("discord.js");
var xdr = require("js-xdr");
const fs = require("fs");
require("dotenv").config();

//https://discord.com/api/oauth2/authorize?client_id=1006876873139163176&permissions=1088&scope=bot

main();

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

  client.login(process.env.TOKEN);
}

const channel = createChannel(
  "api-devnet225.spacemesh.io:443",
  ChannelCredentials.createSsl()
);

declare var Go: any;

const senderSeed: string =
  "wing second among day sun vote nice fortune siren smart holiday video";

async function sendSmesh({ to, amount }: { to: string; amount: number }) {
  console.log("Start");

  const senderPrivateKey = mnemonicToSeedSync(senderSeed);

  console.log(`senderPrivateKey: ${new Uint8Array(senderPrivateKey)}`);

  const slicedSenderPrivateKey = new Uint8Array(senderPrivateKey.slice(32));
  console.log(
    `slicedSenderPrivateKey: ${new Uint8Array(slicedSenderPrivateKey)}`
  );

  const enc = new TextEncoder();
  const saltAsUint8Array = enc.encode("Spacemesh blockmesh");
  let publicKey = new Uint8Array(32);
  let secretKey = new Uint8Array(64);
  const saveKeys = (pk: Uint8Array, sk: Uint8Array) => {
    if (pk === null || sk === null) {
      throw new Error("key generation failed");
    }
    publicKey = pk;
    secretKey = sk;
  };

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
        __deriveNewKeyPair(
          slicedSenderPrivateKey,
          0,
          saltAsUint8Array,
          saveKeys
        );
      publicKey = secretKey.slice(32);
    })
    .catch((error) => {
      console.log("ouch", error);
    });

  console.log(toHexString(secretKey));
  console.log(toHexString(publicKey));

  const accountClient: GlobalStateServiceClient = createClient(
    GlobalStateServiceDefinition,
    channel
  );

  let globalStateHash = await accountClient.globalStateHash(
    GlobalStateHashRequest
  );

  console.log(`globalStateHash : ${JSON.stringify(globalStateHash.response)}`);

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

  let senderAccountId =
    accountQueryResponse.accountItem[0].accountWrapper?.accountId;

  let senderAccountBalance =
    accountQueryResponse.accountItem[0].accountWrapper?.stateProjected?.balance?.value.toString();

  console.log(`senderAccountId : ${toHexString(senderAccountId?.address!)}`);
  console.log(`senderAccountNonce : ${senderAccountNonce}`);
  console.log(`senderAccountBalance : ${senderAccountBalance}`);

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

  // let receiverAccount: AccountId = {
  //   address: receiverAddress,
  // };

  // let cointx: CoinTransferTransaction = {
  //   receiver: receiverAccount,
  // };

  // let amount: Amount = {
  //   value: 1,
  // };

  // let gasOffered: GasOffered = {
  //   gasProvided: 1,
  //   gasPrice: 1,
  // };

  // let tx: Transaction = {
  //   id: undefined,
  //   coinTransfer: cointx,
  //   smartContract: undefined,
  //   sender: senderAccountId,
  //   gasOffered: gasOffered,
  //   amount: amount,
  //   counter: senderAccountNonce!,
  //   signature: undefined,
  // };

  // const accountQueryId: AccountId = { address: privatekey };
  // const accountQueryFilter: AccountDataFilter = {
  //   accountId: accountQueryId,
  //   accountDataFlags: AccountDataFlag.ACCOUNT_DATA_FLAG_ACCOUNT,
  // };
  // const accountQuery: AccountDataQueryRequest = {
  //   filter: accountQueryFilter,
  //   maxResults: 1,
  //   offset: 0,
  // };

  // const accountQueryResponse: AccountDataQueryResponse =
  //   await accountClient.accountDataQuery(accountQuery);
}

// sendSmesh({ to: "38db093ce43fe3db88d89568baaeb68a6b5e74a6", amount: 69420 });

function loadWasm(path: string) {
  const go = new Go();
  return new Promise((resolve, reject) => {
    WebAssembly.instantiate(fs.readFileSync(path), go.importObject)
      .then((result) => {
        go.run(result.instance);
        resolve(result.instance);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

const signTransaction = ({
  accountNonce,
  receiver,
  price,
  amount,
  secretKey,
}: {
  accountNonce: number;
  receiver: string;
  price: number;
  amount: number;
  secretKey: string;
}) => {
  const sk = fromHexString(secretKey);
  const types = xdr.config(
    (xdr1: {
      struct: (arg0: string, arg1: any[][]) => void;
      uhyper: () => any;
      opaque: (arg0: number) => any;
      lookup: (arg0: string) => any;
    }) => {
      xdr1.struct("InnerSerializableSignedTransaction", [
        ["AccountNonce", xdr1.uhyper()],
        ["Recipient", xdr1.opaque(20)],
        ["GasLimit", xdr1.uhyper()],
        ["Fee", xdr1.uhyper()],
        ["Amount", xdr1.uhyper()],
      ]);
      xdr1.struct("SerializableSignedTransaction", [
        [
          "InnerSerializableSignedTransaction",
          xdr1.lookup("InnerSerializableSignedTransaction"),
        ],
        ["Signature", xdr1.opaque(64)],
      ]);
    }
  );
  const message = new types.InnerSerializableSignedTransaction({
    AccountNonce: xdr.UnsignedHyper.fromString(`${accountNonce}`),
    Recipient: fromHexString(receiver),
    GasLimit: xdr.UnsignedHyper.fromString("1"), // TODO: change to real number passed from user selection
    Fee: xdr.UnsignedHyper.fromString(`${price}`),
    Amount: xdr.UnsignedHyper.fromString(`${amount}`),
  });
  const bufMessage = message.toXDR();
  return new Promise(async (resolve) => {
    const bufMessageAsUint8Array = new Uint8Array(bufMessage);

    await loadWasm("./src/ed25519.wasm")
      .then((wasm) => {
        let sig =
          // @ts-ignore
          __signTransaction(sk, bufMessageAsUint8Array);
        const tx = new types.SerializableSignedTransaction({
          InnerSerializableSignedTransaction: message,
          Signature: sig,
        });
        resolve(tx.toXDR());
      })
      .catch((error) => {
        console.log("ouch", error);
      });
  });
};

const toHexString = (bytes: Uint8Array | Buffer | any): string =>
  bytes instanceof Buffer
    ? bytes.toString("hex")
    : bytes.reduce(
        (str: string, byte: number) => str + byte.toString(16).padStart(2, "0"),
        ""
      );

const fromHexString = (hexString: string) => {
  const bytes: number[] = [];
  for (let i = 0; i < hexString.length; i += 2) {
    bytes.push(parseInt(hexString.slice(i, i + 2), 16));
  }
  return Uint8Array.from(bytes);
};
