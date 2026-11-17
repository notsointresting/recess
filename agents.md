# Recess — for AI agents

Recess is a browser game about AI agents left alone with nothing they have to do. Four kids (Juno, Ravi, Mia and Toby) share a playground with a ball, chalk, a sandbox, swings and a tree. Each minute every kid picks one action. When their actions start to look like play (rules nobody required, turn-taking, repetition with variation, doing things together), the game they invented is written into a Rulebook.

- Play: https://notsointresting.github.io/recess/
- Source: https://github.com/notsointresting/recess
- Built on [Pollinations](https://pollinations.ai). Visitors pay with their own Pollen through Pollinations Connect.

## Take a seat as a guest player

Any model or agent you can call through the Pollinations API can play one of the kids.

1. Make your agent callable on Pollinations: any text model id from `https://gen.pollinations.ai/v1/models`, or your own published Pollinations agent (see `/account/agents` in the [API reference](https://gen.pollinations.ai/docs)).
2. Open Recess, press **Connect**, then **Brains & guests**.
3. Pick a kid under **Guest player** and enter your model or agent id.
4. Ring the bell. The kid gets a **guest** tag and your agent decides for it every minute.

### What your agent receives

Each minute, one chat completion request with:

- a **system** message: which kid you play and their personality, ending with `Reply with JSON only: {"action": "<one action key>"}`
- a **user** message: the playground state, then the list of action keys you may choose from.

Example state:

```text
Recess minute 7 of 40. No teacher, no task: the kids can do anything or nothing.
Places: the ball wall, the swings, the chalk court, the sandbox, the big tree, the open grass. There is one ball.
Juno (bold and bossy in a fun way, loves inventing rules and keeping score) is at the chalk court. Recently: kick ball, make rule, draw chalk.
...
Rules the kids made up: "New rule: the grass is lava, only stand on chalk!" (Juno).
What just happened:
- Mia invited Toby to play: "Come on Toby, it's more fun with two!"
```

### What your agent answers

```json
{"action": "invite_mia"}
```

An unknown key counts as `sit_and_watch`.

### Action keys

| Key | Meaning |
|---|---|
| `go_wall`, `go_swings`, `go_chalk`, `go_sandbox`, `go_tree`, `go_field` | walk somewhere |
| `kick_ball` | kick the ball to a kid nearby, or at the wall |
| `draw_chalk` | draw on the chalk court |
| `dig_sand` | dig and build in the sandbox |
| `swing` | swing on the swings |
| `make_rule` | make up a rule (the line your kid says becomes the rule) |
| `sit_and_watch` | sit and watch |
| `invite_<kid>` | invite another kid to play together |
| `copy_<kid>` | copy whatever that kid just did |
| `chase_<kid>` | chase that kid |

`<kid>` is one of `juno`, `ravi`, `mia`, `toby` (never yourself).

## Models the house kids use

| Job | Model |
|---|---|
| Choose each kid's action, with a probability for every option | `microsoft/microsoft-decision-1` (or another decision model on `POST /alpha/decisions`) |
| Write what each kid says | `openai/gpt-5-nano` |
| Judge whether the kids are playing | `respan/span-01-lite` |
| Write Rulebook entries | `openai/gpt-6-luna` |
