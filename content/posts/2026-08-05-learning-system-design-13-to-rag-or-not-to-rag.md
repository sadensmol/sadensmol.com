+++
title = 'Learning System Design #13: To RAG or not to RAG'
slug = 'learning-system-design-13-to-rag-or-not-to-rag'
date = 2026-08-05
draft = false
description = 'RAG explained from a backend dev angle — what it really is, the retrieve-augment-generate pipeline, why it is a search problem, and when you should NOT reach for it.'
tags = ['system-design', 'rag', 'ai', 'llm', 'vector-database']
+++

Part #13 of the "Learning System Design" series! This time — RAG, **Retrieval-Augmented Generation**. The three letters everyone drops into every AI architecture diagram, usually right next to a vector database nobody in the room can quite explain the need for. I kept nodding along in those meetings until I actually sat down and built the thing — and it turns out RAG is far less mysterious, and far more of a plain old search problem, than the hype makes it sound.

![To RAG or not to RAG](/images/posts/learning-system-design-13-to-rag-or-not-to-rag-hero.jpg)

The mental model I keep coming back to is an **open-book exam**. A fine-tuned model is the student who crammed everything into their head and walks in with nothing — fast, but frozen on the day they stopped studying. RAG is the student who walks in *with the textbook* and, for every question, flips to the right page first and answers from it. Same brain, wildly different answers — because one of them gets to look things up.

## What RAG actually is

An LLM only knows two things: what was in its training data, and what you put in the prompt right now. The weights are frozen the day training stops — they don't know your codebase, last week's incident, or anything private.

RAG is the embarrassingly simple pattern of **fetching the relevant bits at question time and pasting them into the prompt**, so the model answers from *your* data instead of its frozen memory. That's the whole idea. Everything else — embeddings, vector DBs, rerankers — is just machinery in service of doing that *fetch* well.

And that reframes the entire problem. It's the one thing I want you to walk away with: **RAG is a search problem wearing an LLM costume.** The LLM part is mostly solved — you call an API or run a local model. The part that decides whether your answers are gold or garbage is the *retrieval*. Feed the wrong chunks into the prompt and the smartest model on earth will confidently answer from the wrong context.

## The pipeline

It splits cleanly into two phases: **build the index once**, then **answer queries against it forever**.

![The RAG pipeline: index your docs once, then embed, search, rerank and generate for every query](/images/posts/learning-system-design-13-to-rag-or-not-to-rag-pipeline.jpg)

**Indexing (offline):**

1. **Chunk** your documents into passages — a paragraph, a section, a few hundred tokens. Too big and you drown the prompt in noise; too small and you slice a thought in half.
2. **Embed** each chunk with an embedding model. An embedding is just a vector — a list of ~768 to 1500 floats that captures the *meaning* of the text. Similar meaning → vectors that sit close together.
3. **Store** those vectors in a **vector database** so you can search them fast.

**Querying (online):**

1. **Embed the question** with the same model.
2. **Search** for the nearest chunk vectors — a nearest-neighbour lookup: "find the k passages whose meaning is closest to this question."
3. **Rerank** the top candidates (optional, but worth it — more below).
4. **Build the prompt**: `question + retrieved chunks + "answer using only this context"`.
5. **Generate** — the LLM writes a grounded answer, ideally with citations back to the chunks.

If you're a backend dev, the retrieval step is less exotic than it sounds. With **pgvector** it's a plain SQL query against Postgres:

```sql
SELECT id, content
FROM chunks
ORDER BY embedding <=> $1   -- $1 = the query's embedding vector
LIMIT 5;
```

That `<=>` is cosine distance. No magic here — it's `ORDER BY ... LIMIT`, just over vectors instead of numbers. Then you stitch the results into the prompt:

```python
context = "\n\n".join(c.content for c in top_chunks)
prompt = f"""Answer using ONLY the context below. Cite chunk ids.

Context:
{context}

Question: {question}"""
answer = llm.generate(prompt)
```

That's a working RAG system. Everything past this point is just making each step better.

## To RAG or not to RAG

Here's the part people skip: RAG is **one option among four**, not the default. When you want a model to "know" something it doesn't, you actually have a menu:

| Approach | What it does | Best when | Weakness |
|---|---|---|---|
| **RAG** | Retrieve context at query time | Data changes, must be private, needs citations | Answer quality capped by retrieval quality |
| **Fine-tuning** | Bake knowledge/behaviour into the weights | Fixed style, format, or narrow skill | Stale the day your data changes; costly to redo |
| **Long context** | Paste everything into one huge prompt | The whole corpus fits the window, one-off | Cost & latency scale with tokens; "lost in the middle" |
| **Agent / tools** | Model calls live APIs and databases | Structured, transactional data or actions | Needs good tools; useless for fuzzy recall |

The decision usually comes down to a few honest questions:

![Decision flow: RAG when data changes and must be private/citable, fine-tune for fixed style, long context when it all fits, agents for live actions](/images/posts/learning-system-design-13-to-rag-or-not-to-rag-decision.jpg)

The rule of thumb I use: **does the knowledge change, and does it need to be private and citable?** If yes → RAG. If you're teaching a fixed *style* or *skill* rather than facts — "always answer in this JSON shape", "write in our brand voice" — that's fine-tuning, not RAG. If the whole thing genuinely fits in one prompt and you'll ask it once, just paste it in; don't stand up a vector DB for a one-off.

And these aren't mutually exclusive. Real systems fine-tune a small reranker, keep a long-context model for the final synthesis, and let an agent decide *when* to retrieve. RAG is the backbone, not the whole skeleton.

## Where the quality actually lives

Because RAG is a search problem, the wins are all in retrieval. Three levers, in the order they'll bite you:

**Chunking.** The most underrated knob. Split on natural boundaries (headings, paragraphs), keep a little overlap so a thought isn't guillotined between two chunks, and attach metadata (source, section, date) you can filter on later. Bad chunking is the #1 reason a RAG demo dazzles and the same system flops in production.

**Hybrid search.** Pure vector search is great at *meaning* but bad at *exact tokens* — product codes, error strings, names. Keyword search (BM25) is the exact opposite. Run both, merge the results, and you catch what either alone misses. Almost every serious system is hybrid.

**Reranking.** Vector search is fast but approximate — it hands you 50 "probably relevant" chunks. A **reranker** is a smaller, slower, more accurate model that reads the query against each candidate and re-scores them, so the *actually* best 5 float to the top of the prompt. It's the cheapest single upgrade to answer quality I know of.

There's a whole zoo beyond this — query rewriting, HyDE, Graph RAG for relationship-heavy questions, multimodal RAG for images and audio — but 90% of your quality comes from chunking well, searching hybrid, and reranking.

## You can run the whole thing yourself

One thing I genuinely like about RAG: none of it forces you onto someone's SaaS. The embedding model, the vector DB, the reranker, even the generator LLM all have solid open-source options you can `docker run` on your own box — pgvector or Qdrant for vectors, a local embedding model, Ollama for the LLM. People are running trimmed RAG stacks on a **Raspberry Pi or a Jetson Nano**. If owning your data is the reason you reached for RAG in the first place, you can own the entire pipeline end to end.

## When you should NOT reach for RAG

RAG is a trade, not a free upgrade. Skip it when:

- **The corpus is tiny and static.** Ten pages that never change? Paste them into the prompt. A vector DB is pure overhead.
- **You need a fixed behaviour, not facts.** "Always output this format" is fine-tuning's job.
- **The data is structured and transactional.** "What's this customer's balance?" is a SQL query or a tool call, not semantic recall. Don't fuzzy-search a number you can look up exactly.
- **Latency is sacred.** Every RAG query is embed → search → (rerank) → generate. That's more moving parts, and more milliseconds, than a single model call.

The failure mode I see most: teams bolt a vector DB onto a problem that was a plain database query all along, then wonder why it's slow and occasionally wrong.

## Summary

- **RAG = fetch relevant context at query time and put it in the prompt**, so the model answers from your data, not its frozen weights.
- Mental model: an **open-book exam** — same brain, but it gets to look things up.
- The pipeline is *index once* (chunk → embed → store) then *query forever* (embed → search → rerank → generate).
- **RAG is a search problem** — retrieval quality caps answer quality, so chunking, hybrid search, and reranking are where the real wins are.
- It's one of four options — **RAG vs fine-tuning vs long context vs agents** — pick by whether the knowledge changes and must be private/citable.
- You can self-host the entire stack, down to a Raspberry Pi.
- Don't RAG a tiny static corpus, a fixed-format task, or an exact lookup.

I wrote this up as a full, hands-on guide — the pipeline in depth, the model zoo, vector DBs, Graph RAG, multimodal, memory, and edge deployment, all self-hosted-first:

https://github.com/sadensmol/learning_system-design/blob/main/rag-guide/README.md

If you want to go deeper on a specific piece, the chapters stand alone:

Foundations — the pipeline in detail:

https://github.com/sadensmol/learning_system-design/blob/main/rag-guide/01-foundations.md

Types of RAG — naive → agentic, HyDE, rerankers, corrective RAG:

https://github.com/sadensmol/learning_system-design/blob/main/rag-guide/02-evolution-and-types.md

Vector databases — FAISS, Qdrant, pgvector, sqlite-vec, HNSW/IVF:

https://github.com/sadensmol/learning_system-design/blob/main/rag-guide/05-vector-databases.md

Graph RAG — when relationships beat plain vectors:

https://github.com/sadensmol/learning_system-design/blob/main/rag-guide/07-graph-rag.md

Edge devices — running RAG on a Raspberry Pi / Jetson:

https://github.com/sadensmol/learning_system-design/blob/main/rag-guide/09-edge-devices.md

Thanks for reading! More system design topics coming in the next parts of the series.

PS: what's your retrieval stack — plain pgvector, a dedicated vector DB, hybrid + rerank, or did you skip RAG entirely and just throw a bigger context window at it? I'd love to hear what actually worked in production.
