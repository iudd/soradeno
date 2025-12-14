# SoraDeno

OpenAI-compatible text-to-video API service deployed on Deno.

## Features

- OpenAI-compatible API format
- Text-to-video generation
- Configuration storage with JSONBin
- Video URL storage with JSONBin
- Deployed on Deno Deploy

## API Endpoints

### Generate Video
```http
POST /v1/videos/generations
Content-Type: application/json

{
  "prompt": "A beautiful sunset over mountains",
  "model": "sora",
  "size": "1920x1080",
  "duration": 5
}
```

### Get Video Status
```http
GET /v1/videos/{video_id}
```

## Configuration

Set the following environment variables:
- `JSONBIN_API_KEY`: Your JSONBin API key
- `JSONBIN_BIN_ID`: Your JSONBin bin ID for configurations
- `VIDEO_BIN_ID`: Your JSONBin bin ID for video URLs

## Deploy

```bash
deployctl deploy --project=soradeno server.ts
```