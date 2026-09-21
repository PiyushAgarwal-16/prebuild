# ULPIN 3D — Documentation

| Document | What it covers |
| --- | --- |
| [PRODUCT.md](PRODUCT.md) | What the product is, who uses it, the three-actor loop, what is differentiated |
| [PROBLEM-STATEMENT-26011.md](PROBLEM-STATEMENT-26011.md) | Clause-by-clause mapping to SIH 26011, with conservative status |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Pipeline stages, register state machine, identifier scheme, interoperability |
| [DATA.md](DATA.md) | Where every layer comes from, what is real, what is assumed, measured accuracy |
| [PRIOR-ART.md](PRIOR-ART.md) | Reference systems worldwide, and what is genuinely new here |

## Running it

```bash
npm install
npm run dev:live     # feed + pipeline + register, port 5181
npm run dev          # workspace, port 5180
```

Requires `OPENAI_API_KEY` in `.env` for floor-plan extraction and level classification.

## A note on status language

These documents mark a capability **built** only if it has been executed and observed. Anything
described as partial, synthetic or assumed is exactly that. The measured accuracy of vision
extraction, and the 7.3 % height-coverage figure for Indian buildings, are reported because they
determine what the system can honestly claim.
