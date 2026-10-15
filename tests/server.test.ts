import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { once } from "node:events";
import { test } from "node:test";

test("HTTP server rejects malformed URLs, validates points, and fails closed without a feed", async () => {
  // Port 0 asks the OS for a free port. This exercises the production request handler.
  const child = spawn(process.execPath, ["server.ts", "--production"], {
    env: { ...process.env, PORT: "0", BOM_NOWCAST_URL: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const base = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Server did not start")),
        5000,
      );
      child.once("error", reject);
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Server exited: ${code}`));
      });
      child.stdout.on("data", (chunk: Buffer) => {
        const address = chunk.toString().match(/http:\/\/localhost:\d+/)?.[0];
        if (address) {
          clearTimeout(timer);
          resolve(address);
        }
      });
    });
    const malformed = await new Promise<number>((resolve, reject) => {
      const req = request(base, { path: "//[" }, (response) => {
        response.resume();
        resolve(response.statusCode!);
      });
      req.once("error", reject);
      req.end();
    });
    assert.equal(malformed, 400);
    assert.equal(
      (await fetch(`${base}/api/forecast?lat=no&lon=151`)).status,
      400,
    );
    assert.equal(
      (await fetch(`${base}/api/forecast?lat=&lon=151`)).status,
      400,
    );
    const missing = await fetch(`${base}/api/forecast?lat=-33.86&lon=151.20`);
    assert.equal(missing.status, 503);
    assert.equal((await missing.json()).code, "feed_unconfigured");
    assert.equal((await fetch(`${base}/api/places?q=x`)).status, 400);
    assert.equal((await fetch(`${base}/api/missing`)).status, 404);
    assert.equal(
      (await fetch(`${base}/api/forecast`, { method: "POST" })).status,
      405,
    );
    assert.equal(child.exitCode, null, "server survived malformed request");
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  }
});
