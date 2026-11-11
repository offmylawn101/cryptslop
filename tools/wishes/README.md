# The Petition Bee: chat builds the game

Players make wishes in the game. Each day the top wishes get built, and you ship them on stream.

## How players take part

- **In the game:** Y opens the board any time in a run, and touch players get a WISH button. The Petition Bee stands in every Honey Lounge under a gold beam (walk up, press E). The title screen has MAKE A WISH right under PLAY, and the pause menu has one too.
- **Making sure every player finds it:** until a player makes their first wish:
  - The board opens by itself once on the title screen, and once when their first run ends. Both times it shows a HOW IT WORKS box.
  - A hint pulses at the top of the HUD.
  - BUZZBY (the buddy bee) points them at the Petition Bee.
  - The beam shows over the Petition Bee.
- **First-wish reward:** 2 wafers.
- **Title-screen counter:** shows how many wishes are waiting and when the next build happens.
- **Tracking adoption:** `node tools/wishes/stats.cjs` shows how many players have wished and voted.
- **Wishing:** unlimited, up to 2,000 characters each. The only limit is one wish every 2 seconds, to stop scripts.
- **Voting:** players upvote other people's wishes (not their own). The board has TOP, NEW, MINE and PATCH NOTES tabs.
- **Credit:** built wishes go in the in-game patch notes under the wisher's name. Their names appear on the lounge sign, and they get the WISHMAKER CROWN cosmetic, which can't be bought.
- **Rejections:** they show in the patch notes with a one-line in-character reason.

## Your day

| When | What | Command |
|---|---|---|
| 1 PM (automatic) | Reads the top 40 wishes. Moderates them. Builds the top 5 by votes plus 1 random wildcard. Opens a report. | `node tools/wishes/daily.cjs` |
| Before 3 PM | Read `wishes/<date>/REPORT.md`, then play the build. | `node tools/wishes/preview.cjs`, then open http://localhost:8081 |
| On stream | Ship it. Add `--drop 12` to leave out wish #12. | `node tools/wishes/approve.cjs` |
| | Make it live | Press Publish in the Wavedash Developer Portal |
| If it's all bad | The wishes go back on the board with their votes. | `node tools/wishes/discard.cjs` |

`approve.cjs` does the following:
1. Merges the day into `main`.
2. Runs `tools/autopush.cjs`, which builds, runs every test and uploads.
3. Writes the patch notes to the server.

Wishes that failed to build go back on the board with their votes.

## Safety

- **The moderator only reads.** Raw wish text goes only to a moderator model with no tools (`claude --restricted --tools ""`). It returns a fixed JSON verdict and a neutral rewrite (the "spec").
- **The builder only sees the spec.** It runs with `claude --restricted` in a throwaway git worktree (`../crypthop-wishes/<date>`):
  - Its file tools only reach that worktree.
  - It has no network access.
  - The one command it may run is `tools/wishes/check.cjs`, which sits outside the worktree.
  - Any action that would need your approval is denied automatically.
- **Tests are sandboxed.** `check.cjs` runs the tests under Node's permission model, so they can only read and write the worktree, and they get a scrubbed environment.
- **Each wish is checked on its own:**
  - Each wish is its own commit.
  - A wish whose tests fail, or that touches files outside `src/` and `tests/`, is thrown away.
  - Code that adds network calls, `eval`, raw HTML and the like is flagged. `approve.cjs` won't continue without `--yes`.
- **Secrets stay out of the worktree.** The admin token is in `%USERPROFILE%\.cryptslop\wishes.json`, never in the repo.
- **Board filters:**
  - Slurs and hate are bounced when a wish is sent: a word filter, plus Llama Guard on Cloudflare.
  - Three reports from different players take a wish off the board.
  - The daily moderator hides the rest.
- **Two human gates:** nothing uploads until you run approve, and nothing goes live until you press Publish.

## One-time setup

1. `cd server/wishes && npx wrangler login`: log in to Cloudflare (a free account is enough).
2. `node tools/wishes/deploy.cjs`: creates the database, deploys the server, saves the admin token and points the game at it. Upload a build afterwards.
3. `node tools/wishes/schedule.cjs 13:00`: adds the daily scheduled task.

Settings live in `%USERPROFILE%\.cryptslop\wishes.json`:

| Setting | Meaning | Default |
|---|---|---|
| `build` | Wishes built per day | 5 |
| `wildcard` | Random picks added on top | 1 |
| `consider` | Top wishes the moderator reads | 40 |
| `builderModel` | Model that builds the wishes | |
| `moderatorModel` | Model that moderates | |
| `builderMinutes` | Time limit per wish | 25 |

**Local testing:** run `node server/wishes/local.mjs`. The game on localhost uses it automatically. To point the pipeline at it, set `WISH_CONFIG` to a JSON file with `{"server":"http://localhost:8787","adminToken":"local-admin-token-0123456789abcdef"}`.
