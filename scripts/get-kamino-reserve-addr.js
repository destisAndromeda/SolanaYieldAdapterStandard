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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var web3_js_1 = require("@solana/web3.js");
var RPC = "https://api.mainnet-beta.solana.com";
var SIG = "4QJBJWyqe3Xs8x5eFWCC5msjahhy53h8E2DRHHZsqfyq6EzdAkB7jcmdM6VKftQvu1cF45CnhjhT2K6QZe3F1bJC";
var KLEND = new web3_js_1.PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
var TOKEN_PROGRAM = new web3_js_1.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
var USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var connection, tx, keys, instructions, ixIndex, ix, programId, j, pubkey, info, extra, parsed, value, mint, amount, _a, owner, len, likelyKlendState;
        var _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    connection = new web3_js_1.Connection(RPC, "confirmed");
                    return [4 /*yield*/, connection.getTransaction(SIG, {
                            commitment: "confirmed",
                            maxSupportedTransactionVersion: 0,
                        })];
                case 1:
                    tx = _j.sent();
                    if (!tx) {
                        throw new Error("Transaction not found");
                    }
                    keys = tx.transaction.message.getAccountKeys({
                        accountKeysFromLookups: (_b = tx.meta) === null || _b === void 0 ? void 0 : _b.loadedAddresses,
                    });
                    instructions = tx.transaction.message.compiledInstructions;
                    ixIndex = 0;
                    _j.label = 2;
                case 2:
                    if (!(ixIndex < instructions.length)) return [3 /*break*/, 11];
                    ix = instructions[ixIndex];
                    programId = keys.get(ix.programIdIndex);
                    if (!(programId === null || programId === void 0 ? void 0 : programId.equals(KLEND)))
                        return [3 /*break*/, 10];
                    console.log("\n==============================");
                    console.log("KLend instruction index:", ixIndex);
                    console.log("Program:", programId.toBase58());
                    console.log("Data:", Buffer.from(ix.data).toString("hex"));
                    console.log("==============================\n");
                    j = 0;
                    _j.label = 3;
                case 3:
                    if (!(j < ix.accountKeyIndexes.length)) return [3 /*break*/, 10];
                    pubkey = keys.get(ix.accountKeyIndexes[j]);
                    if (!pubkey)
                        return [3 /*break*/, 9];
                    return [4 /*yield*/, connection.getAccountInfo(pubkey)];
                case 4:
                    info = _j.sent();
                    extra = "";
                    if (!(info === null || info === void 0 ? void 0 : info.owner.equals(TOKEN_PROGRAM))) return [3 /*break*/, 8];
                    _j.label = 5;
                case 5:
                    _j.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, connection.getParsedAccountInfo(pubkey)];
                case 6:
                    parsed = _j.sent();
                    value = (_c = parsed.value) === null || _c === void 0 ? void 0 : _c.data;
                    if ((_e = (_d = value === null || value === void 0 ? void 0 : value.parsed) === null || _d === void 0 ? void 0 : _d.info) === null || _e === void 0 ? void 0 : _e.mint) {
                        mint = value.parsed.info.mint;
                        amount = (_f = value.parsed.info.tokenAmount) === null || _f === void 0 ? void 0 : _f.uiAmountString;
                        extra = " | token mint: ".concat(mint, " | amount: ").concat(amount);
                        if (mint === USDC_MINT) {
                            extra += " | <<< USDC TOKEN ACCOUNT";
                        }
                    }
                    return [3 /*break*/, 8];
                case 7:
                    _a = _j.sent();
                    return [3 /*break*/, 8];
                case 8:
                    owner = (_g = info === null || info === void 0 ? void 0 : info.owner.toBase58()) !== null && _g !== void 0 ? _g : "missing";
                    len = (_h = info === null || info === void 0 ? void 0 : info.data.length) !== null && _h !== void 0 ? _h : 0;
                    likelyKlendState = (info === null || info === void 0 ? void 0 : info.owner.equals(KLEND))
                        ? " | <<< KLEND STATE CANDIDATE"
                        : "";
                    console.log("".concat(j.toString().padStart(2, "0"), " ").concat(pubkey.toBase58(), " | owner: ").concat(owner, " | len: ").concat(len).concat(likelyKlendState).concat(extra));
                    _j.label = 9;
                case 9:
                    j++;
                    return [3 /*break*/, 3];
                case 10:
                    ixIndex++;
                    return [3 /*break*/, 2];
                case 11: return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
