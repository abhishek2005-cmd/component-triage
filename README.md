# Component Triage

A small take-home app for turning free-text electronics component requests into catalog-backed reply drafts for human review. The catalog data in `data/parts.json` is fictional.

## Architecture

```text
React + CSS ──HTTP──> Node.js / Express ──HTTP──> FastAPI analysis
                           │                          │
                           └──────── MongoDB ──────────┘
                                                      │
                                               FAISS + embeddings
```

React renders backend data and sends actions. Node owns validation, request state, business rules, and transitions. Python owns extraction, embeddings, retrieval, relevance scoring, and draft/refusal generation.

## Technology

- Frontend: React, Vite, plain CSS
- API: Node.js, Express, Mongoose
- Analysis: Python, FastAPI, Pydantic, FAISS, sentence-transformers
- Persistence: MongoDB with a Docker named volume
- Local orchestration: Docker Compose

## Run

Create a local environment file and start the services:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open the UI at `http://localhost:5173`. The API is at `http://localhost:3000`; the analysis service is at `http://localhost:8000`.

Compose waits for MongoDB, runs the one-shot `catalog-seed` service, then starts analysis and API. The seed script replaces the catalog records in the persistent `mongo_data` volume on a clean startup. Do not remove that volume if you need to keep existing data.

To share a temporary public preview, install [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) and run:

```sh
cloudflared tunnel --url http://localhost:5173 --http-host-header localhost:5173
```

Open the `trycloudflare.com` URL printed by the command while the app and tunnel remain running. This temporary preview is public and the app has no sign-in; do not enter sensitive information.

## Oracle Cloud deployment

For a persistent public URL without a paid application-hosting plan, you can run the app on an Oracle Cloud Always Free VM (subject to account, region, and capacity availability). The VM must remain online, and cloud providers may ask for a payment method to verify an account. Keep resources within the Always Free limits and monitor billing. The application has no sign-in, so anyone with the URL can view and modify requests.

1. Create an Ubuntu VM with enough Always Free compute and memory for Docker and the analysis model. Reserve/assign a public IP.
2. Register a domain and create a DNS `A` record for the app hostname pointing to that public IP.
3. In the cloud firewall/security list and Ubuntu firewall, allow inbound TCP `22` only from your IP and TCP `80`/`443` for the website.
4. Install Docker Engine and Docker Compose plugin v2.24 or newer on the VM, then clone this repository there. Grant the VM read-only access to this private GitHub repository; never put access tokens in the Compose files.
5. From the repository directory, create a `.env` file from `.env.example` and set `APP_DOMAIN` to the DNS hostname. Keep the other defaults for the Compose network.
6. Start the production stack:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d
   ```

Caddy obtains and renews the HTTPS certificate automatically. MongoDB, API, and analysis ports are private to the Compose network; only ports 80 and 443 are published. Persist the Docker volumes and do not use `docker compose down -v` if you need to keep request data. The hostname and stable public IP must be ready before starting the stack.

## Tests

Run the API tests with Node's built-in test runner and the analysis tests with Python's standard library test runner:

```sh
npm --prefix api test
python -m pip install -r analysis/requirements.txt
python -m unittest discover -s tests -p "test_*.py"
```

## Environment variables

Set these in the root `.env` file; `.env.example` contains defaults. `FRONTEND_PORT`, `API_PORT`, `ANALYSIS_PORT`, and `MONGODB_PORT` configure published ports; `VITE_API_URL` and `FRONTEND_ORIGIN` configure browser/API origins. `MONGODB_URI` and `MONGODB_DATABASE` configure MongoDB. `RELEVANCE_THRESHOLD` and `EMBEDDING_MODEL` configure retrieval. `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_TIMEOUT_SECONDS` configure optional hosted drafting; the default is local and needs no key. Never commit API keys.

Worker settings: `ANALYSIS_POLL_INTERVAL_MS`, `ANALYSIS_MAX_ATTEMPTS`, `ANALYSIS_RETRY_BASE_DELAY_MS`, `ANALYSIS_RETRY_MAX_DELAY_MS`, `ANALYSIS_LEASE_DURATION_MS`, and `ANALYSIS_REQUEST_TIMEOUT_MS`. MongoDB and internal service URLs are currently specified by Compose.

## API overview

- `GET /api/health` — API health
- `GET /api/requests`, `GET /api/requests/:id` — list and inspect requests
- `POST /api/requests` — submit `{ "text": "..." }`; requires an `Idempotency-Key` header
- `GET /api/statuses`, `GET /api/categories` — backend-provided workflow and catalog categories
- `POST /api/requests/:id/approve`, `POST /api/requests/:id/reject` — review actions
- `PATCH /api/requests/:id/draft` — edit a draft
- `POST /analyze` — internal Python analysis endpoint

## Six workflow scenarios

1. **Request submission:** Node validates and stores the request as `pending`; analysis runs asynchronously.
2. **Catalog match:** Python embeds the request and returns up to three catalog matches with relevance scores, plus category/quantity extraction when available.
3. **No suitable match:** Python returns no matches, marks the result for human review, and supplies a refusal draft.
4. **Duplicate retry:** Repeating a submission with the same idempotency key and text returns the existing request rather than creating another.
5. **Analysis outage:** The MongoDB-backed worker records attempts, leases, errors, and retry times; retries use configurable exponential backoff and exhausted work moves to `needs_review`.
6. **Human review:** The UI can edit, approve, or reject; Node validates edits and enforces allowed status transitions.

## Safety and ownership

- **Duplicate handling:** A unique idempotency key and stored request-text hash distinguish a legitimate retry from key reuse with different text (conflict).
- **No-match behavior:** No matches means a refusal and human review, not an unrelated recommendation.
- **Prompt injection and catalog integrity:** Customer text is treated as untrusted. The hosted model can select only retrieved part numbers; Python constructs the reply from canonical retrieved catalog records, including catalog prices. Provider failures fall back to local rendering.
- **API validation:** Node rejects missing/non-string, blank, or over-5000-character request text and requires a bounded idempotency key. Draft edits are also validated server-side.
- **Backend-owned data:** `GET /api/statuses` exposes statuses and transitions; `GET /api/categories` reads categories from MongoDB. React does not define either list or authorize transitions.

## 20-request top-3 evaluation

Run the evaluation against a seeded catalog with the Python analysis service available:

```sh
python tests/evaluation/evaluate.py
```

The fixture contains 20 requests, including one expected no-match. The script reports correct top-three outcomes, total requests, and accuracy percentage; an expected no-match counts as correct only when the service returns no matches and requests human review. **Evaluation result: not run in this environment, so no accuracy score is claimed.** Set `ANALYSIS_URL` to use a non-default service address.

## Next steps

Expand database-backed integration coverage and run the evaluation to record measured top-3 accuracy.

## AI usage

AI assistance was used to help build and document the project. Code and generated content should be reviewed and verified before use.
