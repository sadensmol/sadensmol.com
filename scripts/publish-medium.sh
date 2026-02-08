#!/usr/bin/env bash
set -euo pipefail

# Publishes a single Hugo post to Medium.
# Usage: MEDIUM_TOKEN=xxx ./scripts/publish-medium.sh content/posts/my-post.md

MEDIUM_API="https://api.medium.com/v1"

if [[ -z "${MEDIUM_TOKEN:-}" ]]; then
  echo "Error: MEDIUM_TOKEN env var is required" >&2
  exit 1
fi

POST_FILE="${1:-}"
if [[ -z "$POST_FILE" || ! -f "$POST_FILE" ]]; then
  echo "Error: provide a valid post file path as argument" >&2
  exit 1
fi

# --- Parse TOML frontmatter (between +++ delimiters) ---

frontmatter=$(sed -n '/^+++$/,/^+++$/p' "$POST_FILE" | sed '1d;$d')

title=$(echo "$frontmatter" | grep "^title" | head -1 | sed "s/^title *= *['\"]//;s/['\"] *$//")
draft=$(echo "$frontmatter" | grep "^draft" | head -1 | sed "s/^draft *= *//;s/ *$//")
description=$(echo "$frontmatter" | grep "^description" | head -1 | sed "s/^description *= *['\"]//;s/['\"] *$//")
date_str=$(echo "$frontmatter" | grep "^date" | head -1 | sed "s/^date *= *['\"]\\{0,1\\}//;s/['\"]\\{0,1\\} *$//")

# Parse tags array: tags = ['tag1', 'tag2']
tags_raw=$(echo "$frontmatter" | grep "^tags" | head -1 | sed "s/^tags *= *\[//;s/\] *$//")
IFS=',' read -ra tag_parts <<< "$tags_raw"
tags=()
for t in "${tag_parts[@]}"; do
  cleaned=$(echo "$t" | sed "s/^ *['\"]//;s/['\"] *$//")
  [[ -n "$cleaned" ]] && tags+=("$cleaned")
done
# Medium allows max 3 tags
tags=("${tags[@]:0:3}")

# Skip drafts
if [[ "$draft" == "true" ]]; then
  echo "Skipping draft: $POST_FILE"
  exit 0
fi

# Skip posts already published to Medium
medium_url=$(echo "$frontmatter" | grep "^medium_url" | head -1 | sed "s/^medium_url *= *['\"]//;s/['\"] *$//")
if [[ -n "$medium_url" ]]; then
  echo "Already published to Medium: $medium_url"
  exit 0
fi

if [[ -z "$title" ]]; then
  echo "Error: could not parse title from $POST_FILE" >&2
  exit 1
fi

# --- Extract markdown body (everything after the closing +++) ---

body=$(awk 'BEGIN{n=0} /^\+\+\+$/{n++;next} n>=2{print}' "$POST_FILE")

# --- Build canonical URL ---
# Permalink pattern: /posts/:year/:month/:slug/
# Filename: 2025-02-07-hello-world.md -> slug = hello-world

filename=$(basename "$POST_FILE" .md)
year=$(echo "$date_str" | cut -d'-' -f1)
month=$(echo "$date_str" | cut -d'-' -f2)
# Derive slug: strip leading date (YYYY-MM-DD-) from filename
slug=$(echo "$filename" | sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}-//')

canonical_url="https://sadensmol.com/posts/${year}/${month}/${slug}/"

# --- Get Medium user ID ---

echo "Fetching Medium user ID..."
me_response=$(curl -s -H "Authorization: Bearer ${MEDIUM_TOKEN}" "${MEDIUM_API}/me")

user_id=$(echo "$me_response" | jq -r '.data.id // empty')
if [[ -z "$user_id" ]]; then
  echo "Error: failed to get Medium user ID" >&2
  echo "$me_response" >&2
  exit 1
fi
echo "User ID: ${user_id}"

# --- Build tags JSON array ---

tags_json="[]"
if [[ ${#tags[@]} -gt 0 ]]; then
  tags_json=$(printf '%s\n' "${tags[@]}" | jq -R . | jq -s .)
fi

# --- Publish to Medium ---

echo "Publishing \"${title}\" to Medium..."
payload=$(jq -n \
  --arg title "$title" \
  --arg content "$body" \
  --arg canonicalUrl "$canonical_url" \
  --argjson tags "$tags_json" \
  '{
    title: $title,
    contentFormat: "markdown",
    content: $content,
    tags: $tags,
    canonicalUrl: $canonicalUrl,
    publishStatus: "public"
  }')

publish_response=$(curl -s -X POST \
  -H "Authorization: Bearer ${MEDIUM_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$payload" \
  "${MEDIUM_API}/users/${user_id}/posts")

post_url=$(echo "$publish_response" | jq -r '.data.url // empty')
if [[ -z "$post_url" ]]; then
  echo "Error: failed to publish to Medium" >&2
  echo "$publish_response" >&2
  exit 1
fi

echo "Published: ${post_url}"
