#!/usr/bin/env bash
# Sends one Buttondown email per new post.
# NEW_POSTS is a JSON array of {title, url, description}; BUTTONDOWN_API_KEY authenticates the calls.
set -euo pipefail

jq -c '.[]' <<<"$NEW_POSTS" | while read -r post; do
  payload=$(jq -c '{
    subject: .title,
    body: "\(.description)\n\n<buttondown-button href=\"\(.url)\" align=\"left\" color=\"#2563eb\">Read the post &rarr;</buttondown-button>",
    status: "about_to_send"
  }' <<<"$post")

  curl -sS --fail-with-body -o /dev/null -X POST "https://api.buttondown.com/v1/emails" \
    -H "Authorization: Token ${BUTTONDOWN_API_KEY}" \
    -H "Content-Type: application/json" \
    -H "X-API-Version: 2026-04-01" \
    -H "X-Buttondown-Live-Dangerously: true" \
    -d "$payload"

  echo "Sent: $(jq -r '.title' <<<"$post")"
done
