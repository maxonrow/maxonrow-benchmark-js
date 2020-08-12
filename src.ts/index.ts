'use strict';

import fs from "fs";
import { mxw, nonFungibleToken as nft } from "mxw-sdk-js";
import { nodeProvider } from "./env";
import { progress } from "./utils-mxw";

let sleep = require('sleep');

let airDropValue = process.env.AIRDROP ? process.env.AIRDROP : "100";
let stressLoop = process.env.LOOP ? Number(process.env.LOOP) : 0;

let indent = "     ";
let silent = true;
let silentRpc = true;

if (silent) { silent = nodeProvider.trace.silent; }
if (silentRpc) { silentRpc = nodeProvider.trace.silentRpc; }

let numberOfWallet = process.env.TOTAL_WALLET ? Number(process.env.TOTAL_WALLET) : 0;
if (!numberOfWallet) { numberOfWallet = 0; }

let wallets: mxw.Wallet[] = [];
let mnemonicList: string[] = [];

let rootFolder = __dirname;
let configFolder = rootFolder + "/..";
let outputFile = configFolder + "/wallets.json";

let nftProperties: nft.NonFungibleTokenProperties;
let nftProvider: mxw.Wallet;
let nftIssuer: mxw.Wallet;
let nftMiddleware: mxw.Wallet;

let symbol = "NFT" + randomStr(5);
let itemID = "ITEMID" + randomStr(5);

let defaultOverrides = {
    logSignaturePayload: function (payload) {
        if (!silentRpc) console.log(indent, "signaturePayload:", JSON.stringify(payload));
    },
    logSignedTransaction: function (signedTransaction) {
        if (!silentRpc) console.log(indent, "signedTransaction:", signedTransaction);
    }
}

// =============================
// ** LOAD AUTHORIZED WALLETS **
// =============================

Promise.resolve().then(async () => {
    let kycProvider = await mxw.Kyc.create(mxw.Wallet.fromMnemonic(nodeProvider.kyc.provider).connect(new mxw.providers.JsonRpcProvider(nodeProvider.connection, nodeProvider).on("rpc", function (args) {
        if (!silentRpc) {
            if ("response" == args.action) {
                console.log(indent, "RPC REQ:", JSON.stringify(args.request));
                console.log(indent, "    RES:", JSON.stringify(args.response));
            }
        }
    })));

    let kycIssuer = await mxw.Kyc.create(mxw.Wallet.fromMnemonic(nodeProvider.kyc.issuer).connect(new mxw.providers.JsonRpcProvider(nodeProvider.connection, nodeProvider).on("rpc", function (args) {
        if (!silentRpc) {
            if ("response" == args.action) {
                console.log(indent, "RPC REQ:", JSON.stringify(args.request));
                console.log(indent, "    RES:", JSON.stringify(args.response));
            }
        }
    })));

    let kycMiddleware = await mxw.Kyc.create(mxw.Wallet.fromMnemonic(nodeProvider.kyc.middleware).connect(new mxw.providers.JsonRpcProvider(nodeProvider.connection, nodeProvider).on("rpc", function (args) {
        if (!silentRpc) {
            if ("response" == args.action) {
                console.log(indent, "RPC REQ:", JSON.stringify(args.request));
                console.log(indent, "    RES:", JSON.stringify(args.response));
            }
        }
    })));

    let airDrop = mxw.Wallet.fromMnemonic(nodeProvider.airDrop).connect(new mxw.providers.JsonRpcProvider(nodeProvider.connection, nodeProvider).on("rpc", function (args) {
        if (!silentRpc) {
            if ("response" == args.action) {
                console.log(indent, "RPC REQ:", JSON.stringify(args.request));
                console.log(indent, "    RES:", JSON.stringify(args.response));
            }
        }
    }));

    nftProvider = mxw.Wallet.fromMnemonic(nodeProvider.nonFungibleToken.provider).connect(new mxw.providers.JsonRpcProvider(nodeProvider.connection, nodeProvider).on("rpc", function (args) {
        if (!silentRpc) {
            if ("response" == args.action) {
                console.log(indent, "RPC REQ:", JSON.stringify(args.request));
                console.log(indent, "    RES:", JSON.stringify(args.response));
            }
        }
    }));

    nftIssuer = mxw.Wallet.fromMnemonic(nodeProvider.nonFungibleToken.issuer).connect(new mxw.providers.JsonRpcProvider(nodeProvider.connection, nodeProvider).on("rpc", function (args) {
        if (!silentRpc) {
            if ("response" == args.action) {
                console.log(indent, "RPC REQ:", JSON.stringify(args.request));
                console.log(indent, "    RES:", JSON.stringify(args.response));
            }
        }
    }));



    nftMiddleware = mxw.Wallet.fromMnemonic(nodeProvider.nonFungibleToken.middleware).connect(new mxw.providers.JsonRpcProvider(nodeProvider.connection, nodeProvider).on("rpc", function (args) {
        if (!silentRpc) {
            if ("response" == args.action) {
                console.log(indent, "RPC REQ:", JSON.stringify(args.request));
                console.log(indent, "    RES:", JSON.stringify(args.response));
            }
        }
    }));

    console.log("AirDrop balance:", mxw.utils.formatMxw((await airDrop.getBalance())), "mxw");

    if (0 < numberOfWallet) {
        // ==========================
        // ** CREATE RANDOM WALLET **
        // ==========================

        for (let i = 0; numberOfWallet > i; i++) {
            let wallet = mxw.Wallet.createRandom().connect(new mxw.providers.JsonRpcProvider(nodeProvider.connection, nodeProvider).on("rpc", function (args) {
                if (!silentRpc) {
                    if ("response" == args.action) {
                        console.log(indent, "RPC REQ:", JSON.stringify(args.request));
                        console.log(indent, "    RES:", JSON.stringify(args.response));
                    }
                }
            }));
            wallets.push(wallet);
            mnemonicList.push(wallet.mnemonic);
            progress(wallets.length, numberOfWallet, "Created " + wallets.length + " wallets...");
        }
        progress(wallets.length, numberOfWallet, "Created " + wallets.length + " wallets");
        console.log("");

        fs.writeFileSync(outputFile, JSON.stringify({ wallets: mnemonicList }));

        // ==========================
        // ** WALLET SIGN KYC DATA **
        // ==========================

        let signed = 0;
        let signedTransactions = [];
        {
            let promises: Promise<void>[] = [];

            for (let wallet of wallets) {
                promises.push(
                    mxw.Kyc.create(wallet).then(async (walletKyc) => {
                        let kycData = await walletKyc.sign({
                            country: "MY",
                            idType: "NIC",
                            id: wallet.address,
                            idExpiry: 0,
                            dob: 0,
                            seed: "0x0000000000000000000000000000000000000000000000000000000000000000"
                        });

                        let signedTransaction = await kycProvider.signTransaction({
                            payload: kycData,
                            signatures: []
                        });

                        signedTransactions.push(await kycIssuer.signTransaction(signedTransaction));
                        progress(++signed, numberOfWallet, "Signed " + signed + " wallets...");
                    })
                );
            }
            await Promise.all(promises);
        }

        progress(signed, numberOfWallet, "Signed " + signed + " wallets");
        console.log("");

        let totalWhitelist = 0;
        let promises = Promise.resolve();

        for (let signedTransaction of signedTransactions) {
            promises = promises.then(() => {
                return kycMiddleware.whitelist(signedTransaction, { async: false, bulkSend: true, sendOnly: true, ...defaultOverrides }).then(() => {
                    progress(++totalWhitelist, numberOfWallet, "Whitelist " + totalWhitelist + " wallets...");
                });
            });
        }
        await promises;
        progress(totalWhitelist, numberOfWallet, "Broadcasted " + totalWhitelist + " wallets");
        console.log("");

        // ============================
        // ** CHECK WHITELIST STATUS **
        // ============================

        let whitelisted = 0;

        while (whitelisted < totalWhitelist) {
            progress(null, null, "Waiting for new block... " + (totalWhitelist - whitelisted) + " remaining");
            sleep.sleep(5);

            whitelisted = 0;
            let promises: Promise<void>[] = [];

            for (let wallet of wallets) {
                promises.push(
                    wallet.isWhitelisted().then(async (isWhitelisted) => {
                        if (isWhitelisted) {
                            whitelisted++;
                            progress(null, null, "Waiting for new block... " + (totalWhitelist - whitelisted) + " remaining");
                        }
                    })
                );
            }

            await Promise.all(promises);

            console.log(", whitelisted:", whitelisted);
            if (whitelisted >= totalWhitelist) {
                break;
            }
        }
        progress(null, null, "Whitelisted " + whitelisted + " wallets");
        console.log("");
        console.log("");

        // ==================
        // ** AIRDROP $$$$ **
        // ==================
        {
            let transferred = 0;
            let promises = Promise.resolve();

            for (let wallet of wallets) {
                promises = promises.then(() => {
                    return airDrop.transfer(wallet.address, airDropValue, { async: false, bulkSend: true, sendOnly: true, ...defaultOverrides }).then(() => {
                        progress(++transferred, numberOfWallet, "AirDrop " + transferred + " wallets...");
                    });
                });
            }
            await promises;

            console.log("");
            progress(null, null, "AirDropped " + transferred + " wallets");
            console.log("");
        }

        // ==================
        // ** Create nft  **
        // ==================
        {
            let createdNft = 0;
            let promises = Promise.resolve();
            nftProperties = {
                name: "stressTest" + randomStr(10),
                symbol: symbol,
                fee: {
                    to: nodeProvider.nonFungibleToken.feeCollector,
                    value: mxw.utils.bigNumberify("1")
                },
                metadata: "Stress testing",
                properties: "Stress test"
            };

            // create NFT using above properties
            promises = promises.then(() => {
                return nft.NonFungibleToken.create(nftProperties, airDrop, defaultOverrides).then(() => {
                    progress(++createdNft, numberOfWallet, "Created nft " + nftProperties.symbol);
                });
            });

            await promises;

            console.log("");
            progress(null, null, "Created NFT " + nftProperties.symbol);
            console.log("");
        }

        // ==================
        // ** Approve nft  **
        // ==================
        {

            let approvedNft = 0;
            let promises = Promise.resolve();

            let overrides = {
                tokenFees: [
                    { action: nft.NonFungibleTokenActions.transfer, feeName: "default" },
                    { action: nft.NonFungibleTokenActions.transferOwnership, feeName: "default" },
                    { action: nft.NonFungibleTokenActions.acceptOwnership, feeName: "default" }
                ],
                endorserList: [],
                mintLimit: 1000000000000,
                transferLimit: 1,
                burnable: false,
                transferable: true,
                modifiable: true,
                pub: false

            };

            promises = promises.then(() => {
                return performNonFungibleTokenStatus(symbol, nft.NonFungibleToken.approveNonFungibleToken, overrides).then(() => {
                    progress(++approvedNft, numberOfWallet, "Approved nft " + symbol);
                });
            });

            await promises;

            console.log("");
            progress(null, null, "Approved NFT " + symbol);
            console.log("");
        }

        return;
    }
    else {
        // ===========================
        // ** LOAD GENERATED WALLET **
        // ===========================

        if (fs.existsSync(outputFile)) {
            let config = JSON.parse(fs.readFileSync(outputFile).toString());
            for (let mnemonic of config.wallets) {
                let wallet = mxw.Wallet.fromMnemonic(mnemonic).connect(new mxw.providers.JsonRpcProvider(nodeProvider.connection, nodeProvider).on("rpc", function (args) {
                    if (!silentRpc) {
                        if ("response" == args.action) {
                            console.log(indent, "RPC REQ:", JSON.stringify(args.request));
                            console.log(indent, "    RES:", JSON.stringify(args.response));
                        }
                    }
                }));
                wallets.push(wallet);
                mnemonicList.push(wallet.mnemonic);
                progress(wallets.length, config.wallets.length, "Loaded " + wallets.length + " wallets");
            }
            console.log("");
        }

        // 
        let minted = 0;
        let promises: Promise<void>[] = [];

        for (let wallet of wallets) {
            promises.push(new Promise(async (resolve, reject) => {
                for (let i = 0; i < stressLoop; i++) {
                    // let response = await wallet.transfer(airDrop.address, "1", { async: true, bulkSend: true, sendOnly: true });
                    // transferred++;`
                    // progress(null, null, "Transferred... " + transferred + ", " + response.hash);

                    let nftMinter: nft.NonFungibleToken;
                    nftMinter = new nft.NonFungibleToken("NFTBdHne", airDrop);
                    
                    let itemProp = {
                        symbol: "NFTBdHne",
                        itemID: itemID + randomStr(5),
                        properties: "abcdef"
                    } as nft.NonFungibleTokenItem;
    
                    let response = await nftMinter.mint(wallet.address, itemProp, { async: true, bulkSend: true, sendOnly: true });
                    //let response = await nftMinter.mint(wallet.address, itemProp)

                    // console.log(".......resp : " + response.result)
                    minted++;
                    progress(null, null, "Minted nft item.. " + minted + ", " + response.hash);
                    //progress(null, null, "[response.result].. " + minted + ", " + response.result);
                }
                return resolve();
            }));
        }

        Promise.all(promises).then(() => {
            console.log("");
            console.log("END");
        });
    }

    // ==============
    // ** CLEAN UP **
    // ==============

    for (let wallet of wallets) {
        wallet.provider.removeAllListeners("rpc");
    }

    kycProvider.provider.removeAllListeners("rpc");
    kycIssuer.provider.removeAllListeners("rpc");
    kycMiddleware.provider.removeAllListeners("rpc");

});


function performNonFungibleTokenStatus(symbol: string, perform: any, overrides?: any) {
    return perform(symbol, nftProvider, overrides).then((transaction) => {
        return nft.NonFungibleToken.signNonFungibleTokenStatusTransaction(transaction, nftIssuer);
    }).then((transaction) => {
        return nft.NonFungibleToken.sendNonFungibleTokenStatusTransaction(transaction, nftMiddleware).then((receipt) => {
            return receipt;
        });
    });
}


function randomStr(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}