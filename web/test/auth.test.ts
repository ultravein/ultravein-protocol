import { describe, expect, it } from "vitest";
import { verifyMessage } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { isFresh, messageFor, validName } from "../lib/auth";

const acct = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

describe("auth", () => {
  it("round-trips a signed rig message", async () => {
    const msg = messageFor({ action: "rig", address: acct.address, name: "Rig", tier: "a100", asset: "0x0", ts: 1 });
    const signature = await acct.signMessage({ message: msg });
    expect(await verifyMessage({ address: acct.address, message: msg, signature })).toBe(true);
    expect(msg).toContain(`address: ${acct.address.toLowerCase()}`);
  });

  it("binds every field: a changed tier changes the message", () => {
    const base = { action: "rig" as const, address: acct.address, name: "Rig", asset: "0x0", ts: 1 };
    expect(messageFor({ ...base, tier: "a100" })).not.toBe(messageFor({ ...base, tier: "h100" }));
    expect(messageFor({ ...base, tier: "a100" })).not.toBe(messageFor({ ...base, tier: "a100", asset: "0x1" }));
  });

  it("rejects stale, future and replayed timestamps", () => {
    expect(isFresh(1000, null, 1000)).toBe(true);
    expect(isFresh(1000 - 301, null, 1000)).toBe(false);
    expect(isFresh(1000 + 301, null, 1000)).toBe(false);
    expect(isFresh(1000, 1000, 1000)).toBe(false);
  });

  it("names are 1-32 bytes with no outer whitespace", () => {
    expect(validName("Rig One")).toBe(true);
    expect(validName("")).toBe(false);
    expect(validName(" Rig")).toBe(false);
    expect(validName("x".repeat(33))).toBe(false);
    expect(validName("\n")).toBe(false);
  });
});
