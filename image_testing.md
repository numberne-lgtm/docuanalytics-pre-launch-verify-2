# Image Integration Testing Playbook

## TEST AGENT PROMPT – IMAGE INTEGRATION RULES
Follow these rules exactly. Do not overcomplicate.

### Image Handling Rules
- Always use base64-encoded images for all tests and requests.
- Accepted formats: JPEG, PNG, WEBP only.
- Do not use SVG, BMP, HEIC, or other formats.
- Do not upload blank, solid-color, or uniform-variance images.
- Every image must contain real visual features (objects, edges, textures, shadows).
- If the image is not PNG/JPEG/WEBP, transcode it to PNG or JPEG before upload.
- Re-detect and update the MIME after transformations.
- If the image is animated, extract the first frame only.
- Resize large images to reasonable bounds.

### App-specific
- Endpoint: POST /api/analyze with { user_id, doc_type, filename, mime_type, file_base64 }.
  file_base64 may be a data URL; backend strips the prefix. Model: gemini-2.5-flash.
- A valid user_id must exist (POST /api/session first). Each analyze consumes 1 credit.
- Chat: POST /api/chat with { user_id, analysis_id, question }.
