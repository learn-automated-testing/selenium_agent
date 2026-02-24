# Selenium MCP Server — AWS Lambda Deployment

Remote MCP server running headless Chrome in AWS Lambda, exposed via Streamable HTTP transport.

## Architecture

```
Client (curl / MCP SDK) → Lambda Function URL → MCP Server → Headless Chrome → S3 (screenshots)
```

## Prerequisites

- AWS CLI configured
- Docker installed
- An ECR repository
- A Lambda execution role with basic Lambda permissions (+ S3 write if using screenshots)

## Deployment

### 1. Build & Push Docker Image

```bash
# Create ECR repository (one-time)
aws ecr create-repository --repository-name selenium-ai-agent-mcp --region <REGION>

# Login to ECR
aws ecr get-login-password --region <REGION> \
  | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com

# Build image (from repo root, not the lambda/ folder)
docker build -f lambda/Dockerfile -t selenium-ai-agent-mcp .

# Tag & push
docker tag selenium-ai-agent-mcp:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/selenium-ai-agent-mcp:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/selenium-ai-agent-mcp:latest
```

### 2. Create the Lambda Function

```bash
aws lambda create-function \
  --function-name selenium-ai-agent-mcp \
  --package-type Image \
  --code ImageUri=<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/selenium-ai-agent-mcp:latest \
  --role arn:aws:iam::<ACCOUNT_ID>:role/<LAMBDA_EXECUTION_ROLE> \
  --timeout 120 \
  --memory-size 2048 \
  --architectures x86_64 \
  --environment "Variables={MCP_API_KEY=<YOUR_SECRET_KEY>}" \
  --region <REGION>
```

### 3. Create a Function URL

```bash
aws lambda create-function-url-config \
  --function-name selenium-ai-agent-mcp \
  --auth-type NONE \
  --region <REGION>
```

Returns:

```json
{ "FunctionUrl": "https://<generated-id>.lambda-url.<REGION>.on.aws/" }
```

### 4. Allow Public Access

```bash
aws lambda add-permission \
  --function-name selenium-ai-agent-mcp \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region <REGION>
```

### 5. (Optional) S3 Bucket for Screenshots

```bash
aws s3 mb s3://<YOUR_BUCKET> --region <REGION>

aws lambda update-function-configuration \
  --function-name selenium-ai-agent-mcp \
  --environment "Variables={MCP_API_KEY=<YOUR_SECRET_KEY>,SCREENSHOT_S3_BUCKET=<YOUR_BUCKET>}" \
  --region <REGION>
```

Ensure the Lambda execution role has `s3:PutObject` permission on the bucket.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MCP_API_KEY` | Yes | Bearer token for API access. Also used as default OAuth login password |
| `OAUTH_LOGIN_PASSWORD` | No | Separate password for the OAuth login page (defaults to `MCP_API_KEY`) |
| `SCREENSHOT_S3_BUCKET` | No | S3 bucket name for auto-uploading screenshots |

## Endpoints

| Path | Method | Auth | Description |
|---|---|---|---|
| `/health` | GET | None | Health check |
| `/mcp` | POST | Bearer | MCP protocol (Streamable HTTP) |
| `/register` | POST | None | OAuth dynamic client registration |
| `/authorize` | GET/POST | None | OAuth login page |
| `/token` | POST | Bearer | OAuth token exchange |

## Usage

### Health Check

```bash
curl https://<LAMBDA_URL>/health
```

### Initialize MCP Session

```bash
curl -X POST https://<LAMBDA_URL>/mcp \
  -H "Authorization: Bearer <MCP_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "my-client", "version": "1.0" }
    },
    "id": 1
  }'
```

### Navigate to a Page

```bash
curl -X POST https://<LAMBDA_URL>/mcp \
  -H "Authorization: Bearer <MCP_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "navigate_to",
      "arguments": { "url": "https://example.com" }
    },
    "id": 2
  }'
```

### Take Screenshot (with S3 Upload)

```bash
curl -X POST https://<LAMBDA_URL>/mcp \
  -H "Authorization: Bearer <MCP_API_KEY>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "take_screenshot",
      "arguments": { "filename": "my-screenshot.png" }
    },
    "id": 3
  }'
```

### Screenshot Behavior

| `filename` param | Result |
|---|---|
| Not provided | Returns base64 image inline, no S3 upload |
| Provided | Saves to `/tmp/screenshots/`, auto-uploads to S3 |

## Authentication

Two auth methods are supported:

1. **Static API Key** — pass `MCP_API_KEY` as a Bearer token directly
2. **OAuth 2.1 (Authorization Code + PKCE)** — full flow via `/register`, `/authorize`, `/token` endpoints. Tokens are HMAC-signed with an 8-hour TTL.
