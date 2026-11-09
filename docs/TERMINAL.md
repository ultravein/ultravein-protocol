# Running a rig from the terminal

Your VGA mines only while its terminal runs. This page is the holder's guide; the client itself and its protocol are documented in [`rig/README.md`](../rig/README.md).

## Before you start

- A wallet with a deployed rig (Deploy VGA tab on the dashboard).
- A VGA you can power: one you **bought**, or enough of the token **held** for the VGA you picked.
- Node.js 18 or newer on the machine that will run the rig (a laptop, a VPS, a Raspberry Pi: anything that stays on).

## Four steps

```bash
# 1. get the client (or click "Download rig.mjs" on the Deploy VGA tab)
curl -fsSLo rig.mjs https://<site>/rig.mjs

# 2. make a node: prints a one-time code like UV-8K2F-QX7M-41PD (valid 30 minutes)
node rig.mjs init https://<site>

# 3. paste the code on Deploy VGA → "Paste the code" and sign with your wallet

# 4. run it; it mines while this stays open
node rig.mjs start
```

On Windows PowerShell 5, `curl` is an alias for `Invoke-WebRequest`; use the download button or `curl.exe -fsSLo rig.mjs <url>`.

## Keeping it running

| Setup | Command |
|---|---|
| Linux / macOS, survives logout | `nohup node rig.mjs start > rig.log 2>&1 &` |
| tmux | `tmux new -s rig 'node rig.mjs start'` |
| systemd | a service with `ExecStart=/usr/bin/node /home/you/rig.mjs start` and `Restart=always` |
| pm2 | `pm2 start rig.mjs -- start` |

A heartbeat goes out every 5 minutes and keeps the rig mining for 10. A short network blip costs nothing; the client retries every 30 seconds after a failure.

## What it can and cannot do

| The node key can | The node key cannot |
|---|---|
| Tell the site this terminal is running | Move tokens or claim rewards |
| Show your rig's live status | Change your rig, VGA or reward asset |
| | Buy a VGA |

It is stored at `~/.ultravein/rig.json`. If it leaks, the worst anyone can do is switch your rig on. To replace it: `node rig.mjs init <site> --new` and link the new code; the old node stops working at once.

## One wallet, one rig

Running the same node in two places, or linking several nodes, adds nothing: a wallet has one rig and earns for its online seconds once.
