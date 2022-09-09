import { loadWasm } from "./wasm_loader";

var xdr = require("js-xdr");

export const signTransaction = ({
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
      .then(() => {
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

export const toHexString = (bytes: Uint8Array | Buffer | any): string =>
  bytes instanceof Buffer
    ? bytes.toString("hex")
    : bytes.reduce(
        (str: string, byte: number) => str + byte.toString(16).padStart(2, "0"),
        ""
      );

export const fromHexString = (hexString: string) => {
  const bytes: number[] = [];
  for (let i = 0; i < hexString.length; i += 2) {
    bytes.push(parseInt(hexString.slice(i, i + 2), 16));
  }
  return Uint8Array.from(bytes);
};
