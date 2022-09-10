"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nice_grpc_1 = require("nice-grpc");
const node_fetch_1 = __importDefault(require("node-fetch"));
const global_state_1 = require("@andreivcodes/spacemeshlib/lib/src/proto/dist/spacemesh/v1/global_state");
const global_state_types_1 = require("@andreivcodes/spacemeshlib/lib/src/proto/dist/spacemesh/v1/global_state_types");
const tx_1 = require("@andreivcodes/spacemeshlib/lib/src/proto/dist/spacemesh/v1/tx");
const util_1 = require("@andreivcodes/spacemeshlib/lib/src/util");
const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();
const senderSeed = process.env.SEEDPHRASE;
let url = "https://discover.spacemesh.io/networks.json";
let networkUrl;
let channel;
let initialMsgSend = false;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
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
        client.on("messageCreate", (message) => __awaiter(this, void 0, void 0, function* () {
            //our special channel
            if (message.channel.name == "🏦tap" || message.channel.name == "tap") {
                try {
                    if (message.member.displayName != "spacemesh-tap-bot") {
                        yield getNetwork();
                        let address = message.content.slice(2);
                        yield sendSmesh({ to: address, amount: 100, message: message });
                    }
                }
                catch (e) {
                    console.log(e);
                }
            }
        }));
        client.login(process.env.TOKEN);
    });
}
function getNetwork() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, node_fetch_1.default)(url)
            .then((response) => response.json())
            .then((res) => {
            networkUrl = res[0]["grpcAPI"].slice(0, -1).substring(8);
            channel = (0, nice_grpc_1.createChannel)(`${networkUrl}:443`, nice_grpc_1.ChannelCredentials.createSsl());
        });
    });
}
function sendSmesh({ to, amount, message, }) {
    return __awaiter(this, void 0, void 0, function* () {
        let sk = (yield (0, util_1.derivePrivateKey)(senderSeed, 0));
        let pk = (yield (0, util_1.derivePublicKey)(senderSeed, 0));
        channel = (0, nice_grpc_1.createChannel)(`${networkUrl}:443`, nice_grpc_1.ChannelCredentials.createSsl());
        console.log(`Connecting to ${networkUrl}:443`);
        const accountClient = (0, nice_grpc_1.createClient)(global_state_1.GlobalStateServiceDefinition, channel);
        let dec = new TextDecoder();
        const accountQueryId = { address: pk };
        const accountQueryFilter = {
            accountId: accountQueryId,
            accountDataFlags: global_state_types_1.AccountDataFlag.ACCOUNT_DATA_FLAG_ACCOUNT,
        };
        const accountQuery = {
            filter: accountQueryFilter,
            maxResults: 1,
            offset: 0,
        };
        yield accountClient
            .accountDataQuery(accountQuery)
            .then((result) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            console.log(result.accountItem[0].accountWrapper);
            let senderAccountNonce = (_b = (_a = result.accountItem[0].accountWrapper) === null || _a === void 0 ? void 0 : _a.stateProjected) === null || _b === void 0 ? void 0 : _b.counter;
            let senderAccountBalance = (_e = (_d = (_c = result.accountItem[0].accountWrapper) === null || _c === void 0 ? void 0 : _c.stateProjected) === null || _d === void 0 ? void 0 : _d.balance) === null || _e === void 0 ? void 0 : _e.value;
            console.log(`Tap currently running on address 0x${(0, util_1.toHexString)(pk)} with nonce ${senderAccountNonce} and has a balance of ${senderAccountBalance} SMD`);
            let tx = yield (0, util_1.signTransaction)({
                accountNonce: Number(senderAccountNonce),
                receiver: to,
                gasLimit: 1,
                fee: 1,
                amount: amount,
                secretKey: (0, util_1.toHexString)(sk),
            });
            const transactionClient = (0, nice_grpc_1.createClient)(tx_1.TransactionServiceDefinition, channel);
            transactionClient
                .submitTransaction({
                transaction: tx,
            })
                .then((response) => {
                var _a, _b, _c;
                console.log(`Sent tx id: ${(0, util_1.toHexString)((_b = (_a = response.txstate) === null || _a === void 0 ? void 0 : _a.id) === null || _b === void 0 ? void 0 : _b.id)}`);
                if (((_c = response.status) === null || _c === void 0 ? void 0 : _c.code) == 0) {
                    message.reply(`just 💸  transferred funds to ${message.content}`);
                    console.log(`just 💸  transferred funds to ${message.content}`);
                }
                else
                    message.reply(`could not transfer :(`);
            })
                .catch((e) => {
                console.log(e);
            });
        }))
            .catch((e) => {
            console.log(e);
        });
    });
}
main();
