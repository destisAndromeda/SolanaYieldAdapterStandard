import * as anchor from "@anchor-lang/core";
import { AnchorError } from "@anchor-lang/core";
import { assert } from "chai";
import { Transaction } from "@solana/web3.js";
import {
  EXTRA_DATA_MAX_LEN,
  ADAPTER_STATUS_ACTIVE,
  ADAPTER_STATUS_PAUSED,
  MOCK_CURRENT_VALUE,
  USDC_MINT,
  activeAdapterPda,
  adapterAuthority,
  airdrop,
  dispatcherProgram,
  inactiveAdapterAuthority,
  inactiveAdapterPda,
  keypairFromSeed,
  mockAdapterProgram,
  mockAdapterProgramAccount,
  parseDispatcherEvents,
  parseMockAdapterEvents,
  provider,
  registryBump,
  registryPda,
  systemProgram,
  toggleAdapterAuthority,
  toggleAdapterPda,
  unauthorized,
} from "./shared";

function accounts<T>(accounts: T): any {
  return accounts as any;
}

describe("registry_init", () => {
  it("error: wrong signer returns Unauthorized", async () => {
    await airdrop(unauthorized.publicKey);

    try {
      await dispatcherProgram.methods
        .registryInit()
        .accounts(accounts({
          initializer: unauthorized.publicKey,
          registry: registryPda,
          systemProgram,
        }))
        .signers([unauthorized])
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "Unauthorized");
    }
  });

  it("happy: creates registry PDA with correct initializer and bump", async () => {
    await dispatcherProgram.methods
      .registryInit()
      .accounts(accounts({
        initializer: provider.wallet.publicKey,
        registry: registryPda,
        systemProgram,
      }))
      .rpc();

    const registry = await dispatcherProgram.account.registry.fetch(registryPda);

    assert.isTrue(registry.initializer.equals(provider.wallet.publicKey));
    assert.strictEqual(registry.bump, registryBump);
  });
});

describe("adapter_init", () => {
  before(async () => {
    await airdrop(adapterAuthority.publicKey);
    await airdrop(inactiveAdapterAuthority.publicKey);
    await airdrop(toggleAdapterAuthority.publicKey);
  });

  it("error: non-initializer signer returns Unauthorized", async () => {
    const strayAuthority = keypairFromSeed("stray-adapter-authority");

    try {
      await dispatcherProgram.methods
        .adapterInit({
          authority: strayAuthority.publicKey,
          programId: mockAdapterProgram.programId,
          supportedMint: USDC_MINT,
          status: ADAPTER_STATUS_ACTIVE,
        })
        .accounts(accounts({
          initializer: unauthorized.publicKey,
          adapter: anchor.web3.PublicKey.findProgramAddressSync(
            [
              Buffer.from("dispatcher"),
              mockAdapterProgram.programId.toBuffer(),
              Buffer.from("adapter_info"),
              strayAuthority.publicKey.toBuffer(),
            ],
            dispatcherProgram.programId,
          )[0],
          registry: registryPda,
          systemProgram,
        }))
        .signers([unauthorized])
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "Unauthorized");
    }
  });

  it("happy: creates active adapter with correct fields", async () => {
    await dispatcherProgram.methods
      .adapterInit({
        authority: adapterAuthority.publicKey,
        programId: mockAdapterProgram.programId,
        supportedMint: USDC_MINT,
        status: ADAPTER_STATUS_ACTIVE,
      })
      .accounts(accounts({
        initializer: provider.wallet.publicKey,
        adapter: activeAdapterPda,
        registry: registryPda,
        systemProgram,
      }))
      .rpc();

    const adapter = await dispatcherProgram.account.adapter.fetch(activeAdapterPda);

    assert.isTrue(adapter.authority.equals(adapterAuthority.publicKey));
    assert.isTrue(adapter.programId.equals(mockAdapterProgram.programId));
    assert.isTrue(adapter.supportedMint.equals(USDC_MINT));
    assert.strictEqual(adapter.status, ADAPTER_STATUS_ACTIVE);
  });

  it("error: invalid status returns InvalidStatus", async () => {
    const invalidStatusAuthority = keypairFromSeed("invalid-status-authority");

    try {
      await dispatcherProgram.methods
        .adapterInit({
          authority: invalidStatusAuthority.publicKey,
          programId: mockAdapterProgram.programId,
          supportedMint: USDC_MINT,
          status: 99,
        })
        .accounts(accounts({
          initializer: provider.wallet.publicKey,
          adapter: anchor.web3.PublicKey.findProgramAddressSync(
            [
              Buffer.from("dispatcher"),
              mockAdapterProgram.programId.toBuffer(),
              Buffer.from("adapter_info"),
              invalidStatusAuthority.publicKey.toBuffer(),
            ],
            dispatcherProgram.programId,
          )[0],
          registry: registryPda,
          systemProgram,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "InvalidStatus");
    }
  });

  it("error: default authority returns InvalidAccount", async () => {
    const defaultAuthority = anchor.web3.PublicKey.default;

    try {
      await dispatcherProgram.methods
        .adapterInit({
          authority: defaultAuthority,
          programId: mockAdapterProgram.programId,
          supportedMint: USDC_MINT,
          status: ADAPTER_STATUS_ACTIVE,
        })
        .accounts(accounts({
          initializer: provider.wallet.publicKey,
          adapter: anchor.web3.PublicKey.findProgramAddressSync(
            [
              Buffer.from("dispatcher"),
              mockAdapterProgram.programId.toBuffer(),
              Buffer.from("adapter_info"),
              defaultAuthority.toBuffer(),
            ],
            dispatcherProgram.programId,
          )[0],
          registry: registryPda,
          systemProgram,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "InvalidAccount");
    }
  });

  it("error: default programId returns InvalidAccount", async () => {
    const defaultProgramIdAuthority = keypairFromSeed("default-program-id-authority");

    try {
      await dispatcherProgram.methods
        .adapterInit({
          authority: defaultProgramIdAuthority.publicKey,
          programId: anchor.web3.PublicKey.default,
          supportedMint: USDC_MINT,
          status: ADAPTER_STATUS_ACTIVE,
        })
        .accounts(accounts({
          initializer: provider.wallet.publicKey,
          adapter: anchor.web3.PublicKey.findProgramAddressSync(
            [
              Buffer.from("dispatcher"),
              anchor.web3.PublicKey.default.toBuffer(),
              Buffer.from("adapter_info"),
              defaultProgramIdAuthority.publicKey.toBuffer(),
            ],
            dispatcherProgram.programId,
          )[0],
          registry: registryPda,
          systemProgram,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "InvalidAccount");
    }
  });

  it("error: default supportedMint returns InvalidAccount", async () => {
    const defaultSupportedMintAuthority = keypairFromSeed("default-supported-mint-authority");

    try {
      await dispatcherProgram.methods
        .adapterInit({
          authority: defaultSupportedMintAuthority.publicKey,
          programId: mockAdapterProgram.programId,
          supportedMint: anchor.web3.PublicKey.default,
          status: ADAPTER_STATUS_ACTIVE,
        })
        .accounts(accounts({
          initializer: provider.wallet.publicKey,
          adapter: anchor.web3.PublicKey.findProgramAddressSync(
            [
              Buffer.from("dispatcher"),
              mockAdapterProgram.programId.toBuffer(),
              Buffer.from("adapter_info"),
              defaultSupportedMintAuthority.publicKey.toBuffer(),
            ],
            dispatcherProgram.programId,
          )[0],
          registry: registryPda,
          systemProgram,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "InvalidAccount");
    }
  });

  it("happy: stores paused status correctly", async () => {
    await dispatcherProgram.methods
      .adapterInit({
        authority: inactiveAdapterAuthority.publicKey,
        programId: mockAdapterProgram.programId,
        supportedMint: USDC_MINT,
        status: ADAPTER_STATUS_PAUSED,
      })
      .accounts(accounts({
        initializer: provider.wallet.publicKey,
        adapter: inactiveAdapterPda,
        registry: registryPda,
        systemProgram,
      }))
      .rpc();

    const adapter = await dispatcherProgram.account.adapter.fetch(inactiveAdapterPda);

    assert.isTrue(adapter.authority.equals(inactiveAdapterAuthority.publicKey));
    assert.isTrue(adapter.programId.equals(mockAdapterProgram.programId));
    assert.isTrue(adapter.supportedMint.equals(USDC_MINT));
    assert.strictEqual(adapter.status, ADAPTER_STATUS_PAUSED);
  });

  it("error: calling twice with same seeds fails with account already in use", async () => {
    try {
      await dispatcherProgram.methods
        .adapterInit({
          authority: adapterAuthority.publicKey,
          programId: mockAdapterProgram.programId,
          supportedMint: USDC_MINT,
          status: ADAPTER_STATUS_ACTIVE,
        })
        .accounts(accounts({
          initializer: provider.wallet.publicKey,
          adapter: activeAdapterPda,
          registry: registryPda,
          systemProgram,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.match(String(e), /already in use/i);
    }
  });
});

describe("toggle_adapter", () => {
  before(async () => {
    await dispatcherProgram.methods
      .adapterInit({
        authority: toggleAdapterAuthority.publicKey,
        programId: mockAdapterProgram.programId,
        supportedMint: USDC_MINT,
        status: ADAPTER_STATUS_ACTIVE,
      })
      .accounts(accounts({
        initializer: provider.wallet.publicKey,
        adapter: toggleAdapterPda,
        registry: registryPda,
        systemProgram,
      }))
      .rpc();
  });

  it("happy: authority toggles active status to paused", async () => {
    const txSig = await dispatcherProgram.methods
      .toggleAdapter()
      .accounts(accounts({
        authority: toggleAdapterAuthority.publicKey,
        adapter: toggleAdapterPda,
      }))
      .signers([toggleAdapterAuthority])
      .rpc();

    const adapter = await dispatcherProgram.account.adapter.fetch(toggleAdapterPda);
    assert.strictEqual(adapter.status, ADAPTER_STATUS_PAUSED);

    const events = await parseDispatcherEvents(txSig);
    const toggleEvent = events.find((event) => event.name === "toggleEvent");
    assert.isDefined(toggleEvent);
    assert.isTrue(toggleEvent!.data.authority.equals(toggleAdapterAuthority.publicKey));
    assert.isTrue(toggleEvent!.data.adapter.equals(toggleAdapterPda));
    assert.isTrue(toggleEvent!.data.programId.equals(mockAdapterProgram.programId));
    assert.strictEqual(toggleEvent!.data.status, ADAPTER_STATUS_PAUSED);
  });

  it("happy: second toggle flips paused status back to active", async () => {
    const txSig = await dispatcherProgram.methods
      .toggleAdapter()
      .accounts(accounts({
        authority: toggleAdapterAuthority.publicKey,
        adapter: toggleAdapterPda,
      }))
      .signers([toggleAdapterAuthority])
      .rpc();

    const adapter = await dispatcherProgram.account.adapter.fetch(toggleAdapterPda);
    assert.strictEqual(adapter.status, ADAPTER_STATUS_ACTIVE);

    const events = await parseDispatcherEvents(txSig);
    const toggleEvent = events.find((event) => event.name === "toggleEvent");
    assert.isDefined(toggleEvent);
    assert.strictEqual(toggleEvent!.data.status, ADAPTER_STATUS_ACTIVE);
  });

  it("error: wrong authority returns Unauthorized", async () => {
    try {
      await dispatcherProgram.methods
        .toggleAdapter()
        .accounts(accounts({
          authority: unauthorized.publicKey,
          adapter: toggleAdapterPda,
        }))
        .signers([unauthorized])
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "Unauthorized");
    }
  });
});

describe("deposit", () => {
  const depositAmount = new anchor.BN(1_000_000);

  // it("happy: active adapter with valid extra_data succeeds", async () => {
  //   const extraData = Buffer.from([1, 2, 3, 4]);

  //   const txSig = await dispatcherProgram.methods
  //     .deposit({
  //       amount: depositAmount,
  //       extraData,
  //     })
  //     .accounts(accounts({
  //       signer: provider.wallet.publicKey,
  //       adapter: activeAdapterPda,
  //     }))
  //     .remainingAccounts([
  //       {
  //         pubkey: provider.wallet.publicKey,
  //         isSigner: true,
  //         isWritable: true,
  //       },
  //       mockAdapterProgramAccount,
  //     ])
  //     .rpc();

  //   const events = await parseDispatcherEvents(txSig);
  //   const depositEvent = events.find((event) => event.name === "depositEvent");
  //   assert.isDefined(depositEvent);
  //   assert.isTrue(depositEvent!.data.authority.equals(provider.wallet.publicKey));
  //   assert.isTrue(depositEvent!.data.programId.equals(mockAdapterProgram.programId));
  //   assert.isTrue(depositEvent!.data.amount.eq(depositAmount));

  //   const mockEvents = await parseMockAdapterEvents(txSig);
  //   console.log("Mock adapter events:", mockEvents.map(e => ({ name: e.name, ...e })));
  //   const mockDepositEvent = mockEvents.find((event) => event.name === "mockDepositCalled");
  //   assert.isDefined(mockDepositEvent);
  //   assert.isTrue(mockDepositEvent!.data.authority.equals(provider.wallet.publicKey));
  //   assert.isTrue(mockDepositEvent!.data.amount.eq(depositAmount));
  //   assert.deepStrictEqual(Buffer.from(mockDepositEvent!.data.extra_data), extraData);
  // });

  it("happy: empty extra_data succeeds", async () => {
    await dispatcherProgram.methods
      .deposit({
        amount: depositAmount,
        extraData: Buffer.alloc(0),
      })
      .accounts(accounts({
        signer: provider.wallet.publicKey,
        adapter: activeAdapterPda,
      }))
      .remainingAccounts([
        {
          pubkey: provider.wallet.publicKey,
          isSigner: true,
          isWritable: true,
        },
        mockAdapterProgramAccount,
      ])
      .rpc();
  });

  it(`happy: extra_data of exactly ${EXTRA_DATA_MAX_LEN} bytes succeeds`, async () => {
    const extraData = Buffer.alloc(EXTRA_DATA_MAX_LEN, 7);

    await dispatcherProgram.methods
      .deposit({
        amount: depositAmount,
        extraData,
      })
      .accounts(accounts({
        signer: provider.wallet.publicKey,
        adapter: activeAdapterPda,
      }))
      .remainingAccounts([
        {
          pubkey: provider.wallet.publicKey,
          isSigner: true,
          isWritable: true,
        },
        mockAdapterProgramAccount,
      ])
      .rpc();
  });

  it("error: inactive adapter returns Inactive", async () => {
    try {
      await dispatcherProgram.methods
        .deposit({
          amount: depositAmount,
          extraData: Buffer.alloc(0),
        })
        .accounts(accounts({
          signer: provider.wallet.publicKey,
          adapter: inactiveAdapterPda,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "Inactive");
    }
  });

  it("error: extra_data longer than max returns Overflow", async () => {
    const extraData = Buffer.alloc(EXTRA_DATA_MAX_LEN + 1, 9);

    try {
      await dispatcherProgram.methods
        .deposit({
          amount: depositAmount,
          extraData,
        })
        .accounts(accounts({
          signer: provider.wallet.publicKey,
          adapter: activeAdapterPda,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "Overflow");
    }
  });
});

describe("withdraw", () => {
  const withdrawAmount = new anchor.BN(2_500_000);

  // it("happy: active adapter with valid extra_data succeeds", async () => {
  //   const extraData = Buffer.from([5, 6, 7, 8]);

  //   const txSig = await dispatcherProgram.methods
  //     .withdraw({
  //       amount: withdrawAmount,
  //       extraData,
  //     })
  //     .accounts(accounts({
  //       signer: provider.wallet.publicKey,
  //       adapter: activeAdapterPda,
  //     }))
  //     .remainingAccounts([
  //       {
  //         pubkey: provider.wallet.publicKey,
  //         isSigner: true,
  //         isWritable: true,
  //       },
  //       mockAdapterProgramAccount,
  //     ])
  //     .rpc();

  //   const events = await parseDispatcherEvents(txSig);
  //   const withdrawEvent = events.find((event) => event.name === "withdrawEvent");
  //   assert.isDefined(withdrawEvent);
  //   assert.isTrue(withdrawEvent!.data.authority.equals(provider.wallet.publicKey));
  //   assert.isTrue(withdrawEvent!.data.programId.equals(mockAdapterProgram.programId));
  //   assert.isTrue(withdrawEvent!.data.amount.eq(withdrawAmount));

  //   const mockEvents = await parseMockAdapterEvents(txSig);
  //   const mockWithdrawEvent = mockEvents.find((event) => event.name === "mockWithdrawCalled");
  //   assert.isDefined(mockWithdrawEvent);
  //   assert.isTrue(mockWithdrawEvent!.data.authority.equals(provider.wallet.publicKey));
  //   assert.isTrue(mockWithdrawEvent!.data.amount.eq(withdrawAmount));
  //   assert.deepStrictEqual(Buffer.from(mockWithdrawEvent!.data.extra_data), extraData);
  // });

  it("happy: empty extra_data succeeds", async () => {
    await dispatcherProgram.methods
      .withdraw({
        amount: withdrawAmount,
        extraData: Buffer.alloc(0),
      })
      .accounts(accounts({
        signer: provider.wallet.publicKey,
        adapter: activeAdapterPda,
      }))
      .remainingAccounts([
        {
          pubkey: provider.wallet.publicKey,
          isSigner: true,
          isWritable: true,
        },
        mockAdapterProgramAccount,
      ])
      .rpc();
  });

  it(`happy: extra_data of exactly ${EXTRA_DATA_MAX_LEN} bytes succeeds`, async () => {
    const extraData = Buffer.alloc(EXTRA_DATA_MAX_LEN, 3);

    await dispatcherProgram.methods
      .withdraw({
        amount: withdrawAmount,
        extraData,
      })
      .accounts(accounts({
        signer: provider.wallet.publicKey,
        adapter: activeAdapterPda,
      }))
      .remainingAccounts([
        {
          pubkey: provider.wallet.publicKey,
          isSigner: true,
          isWritable: true,
        },
        mockAdapterProgramAccount,
      ])
      .rpc();
  });

  it("error: inactive adapter returns Inactive", async () => {
    try {
      await dispatcherProgram.methods
        .withdraw({
          amount: withdrawAmount,
          extraData: Buffer.alloc(0),
        })
        .accounts(accounts({
          signer: provider.wallet.publicKey,
          adapter: inactiveAdapterPda,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "Inactive");
    }
  });

  it("error: extra_data longer than max returns Overflow", async () => {
    const extraData = Buffer.alloc(EXTRA_DATA_MAX_LEN + 1, 1);

    try {
      await dispatcherProgram.methods
        .withdraw({
          amount: withdrawAmount,
          extraData,
        })
        .accounts(accounts({
          signer: provider.wallet.publicKey,
          adapter: activeAdapterPda,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "Overflow");
    }
  });
});

describe("current_value", () => {
  it("happy: active adapter invokes mock adapter successfully and returns value", async () => {
    const ix = await dispatcherProgram.methods
      .currentValue()
      .accounts(accounts({
        authority: provider.wallet.publicKey,
        adapter: activeAdapterPda,
      }))
      .remainingAccounts([
        {
          pubkey: provider.wallet.publicKey,
          isSigner: true,
          isWritable: true,
        },
        mockAdapterProgramAccount,
      ])
      .instruction();

    const tx = new Transaction().add(ix);
    tx.feePayer = provider.wallet.publicKey;
    const latest = await provider.connection.getLatestBlockhash();
    tx.recentBlockhash = latest.blockhash;

    const signedTx = await provider.wallet.signTransaction(tx);
    const sim = await provider.connection.simulateTransaction(signedTx);

    assert.strictEqual(sim.value.err, null);
    assert.isDefined(sim.value.returnData);

    const raw = Buffer.from(sim.value.returnData!.data[0], "base64");
    const value = raw.readBigUInt64LE(0);
    assert.strictEqual(value, BigInt(MOCK_CURRENT_VALUE));
  });

  it("error: inactive adapter returns Inactive", async () => {
    try {
      await dispatcherProgram.methods
        .currentValue()
        .accounts(accounts({
          authority: provider.wallet.publicKey,
          adapter: inactiveAdapterPda,
        }))
        .rpc();
      assert.fail("expected error");
    } catch (e) {
      assert.instanceOf(e, AnchorError);
      assert.strictEqual(e.error.errorCode.code, "Inactive");
    }
  });
});
